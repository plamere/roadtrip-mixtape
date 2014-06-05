var fullTrackCount = 0;
var reverseTime = false;
var curDuration = 0;
var paused;
var playing = false;
var playQueue = [];
var audio = new Audio();
var artistSongs = {};
var config = getConfig();

function initPlayer() {
    configureControls();

    audio = $("<audio>");
    audio.on('pause', function() {
        setPlaying(false);
    });

    audio.on('timeupdate', function() {
        var time = audio.get(0).currentTime;
        positionChanged(time);
    });

    audio.on('play', function() {
        setPlaying(true);
    });

    audio.on('ended', function() {
        next();
    });
}

function configureControls() {
    $("#pause").click(togglePauseResume);
    $("#next").click(next);
    $("#mute").click(toggleMute);
}


function togglePauseResume(event) {
    if (isPaused()) {
        audioResume();
    } else {
        audioPause();
    }
    return false;
}


function toggleMute() {
    if (isMuted()) {
        audioUnMute();
        $("#mute_img").attr('src', 'assets/Sound_Button.png');
    }  else {
        audioMute();
        $("#mute_img").attr('src', 'assets/Mute_Button.png');
    }
    return false;
}

function isPaused() {
    return paused;
}

function isMuted() {
    return $("#mute_img").attr('src') === 'assets/Mute_Button.png';
}

function setPlaying(isPlaying) {
    if (isPlaying) {
        paused = false;
       $('#pause').css("background-image", "url(assets/Pause_StackedButton2.png)");
    } else {
        paused = true;
       $('#pause').css("background-image", "url(assets/Play_StackedButton2.png)");
    }
}

function getTopTracksForSpotifyArtist(sid, callback) {
    var url = 'https://api.spotify.com/v1/artists/' + sid + '/top-tracks?country=US';
    $.getJSON(url, function(data) {
        callback(data.tracks);
    });
}

function filterTracks(tracks) {
    var out = [];

    function isGoodTrack(track) {
        return track.preview_url != null;
    }

    tracks.forEach(function(track) {
        if (isGoodTrack(track)) {
            out.push(track);
        }
    });
    return out;
}

function playSpotifyArtist(artist) {
    if (! ('tracks' in artist)) {
        var url = config.echoNestHost + 'artist/profile';
        $.getJSON(url, { id:artist.artist_id, api_key:config.apiKey, bucket:config.spotifySpace}, function(data) {
            if (data.response.status.code == 0) {
                var partist = data.response.artist;
                if ('foreign_ids' in partist && partist.foreign_ids.length > 0) {
                    var spotifyArtistID = partist.foreign_ids[0].foreign_id;
                    var fields = spotifyArtistID.split(':');
                    var sid = fields[fields.length - 1];
                    getTopTracksForSpotifyArtist(sid, function(tracks) {
                        var ftracks = filterTracks(tracks);
                        if (ftracks && ftracks.length > 0) {
                            artist.tracks = ftracks;
                            artist.trackIndex = 0;
                            playNextArtistTrack(artist);
                        } else {
                            next();
                        }
                    });
                } else {
                    next();
                }
            } else {
                next();
            }
        });
    } else {
        playNextArtistTrack(artist);
    }
}

function playNextArtistTrack(artist) {
    var track = artist.tracks[artist.trackIndex++];
    if (artist.trackIndex >= artist.tracks.length) {
        artist.trackIndex = 0;
    }

    $("#song-title").text(track.name);
    $("#artist-name").text(artist.name);
    var image = getBestImage(track.album.images, 200);
    if (image) {
        $("#album-art-img").attr('src', image.url);
    }
    audio.attr('src', track.preview_url);
    audioResume();
}

function getBestImage(images, minWidth) {
    var best = images[0];
    images.forEach(
        function(image) {
            if (image.width >= minWidth) {
                best = image;
            }
        }
    );
    return best;
}

function isPlaying() {
    return playing;
}

function queueSong(song, callback) {
    var qItem = { song:song, callback:callback};
    playQueue.push(qItem);
    if (! isPlaying()) {
        next();
    }
}

function queueArtist(artist, callback) {
    var qItem = { artist:artist, callback:callback};
    playQueue.push(qItem);
    if (! isPlaying()) {
        next();
    }
}

function clearQueue() {
    playQueue = [];
    playing = false;
}

function next() {
    if (playQueue.length > 0) {
        playing = true;
        var qitem = playQueue.shift();
        if (qitem.callback) {
            qitem.callback();
        }
        playSpotifyArtist(qitem.artist);
    }  else {
        playing = false;
        needMoreSongs();
    }
}



function audioStop() {
    audio.get(0).pause();
}

function audioPause() {
    audio.get(0).pause();
}

function audioResume() {
    audio.get(0).play();
}

function audioMute() {
    audio.get(0).volume = 0;
}

function audioUnMute() {
    audio.get(0).volume = 1;
}

function getTinyId(id) {
    var idx = id.lastIndexOf(":");
    if (idx >=0) {
        return id.substring(idx + 1);
    } else {
        return id;
    }
}

function playingSourceChanged(playingSource) {
  // The currently playing source changed.
  // The source metadata, including a track listing is inside playingSource.
  if (playingSource === null) {
      next();
    }
};


function positionChanged(position) {
  //The position within the track changed to position seconds.
  // This happens both in response to a seek and during playback.

  if (reverseTime) {
       if (curDuration > position) {
           position = curDuration - position; 
       }
  }
  $('#track-time').text(fmtTime(position));
};

// Reverses how we display time. When reversed we
// show the amount of time remaining in the song
//
function toggleReverseTime() {
    reverseTime = !reverseTime;
}

function fmtTime(position) {
    position = Math.round(position);
    var mins = Math.floor(position / 60);
    var secs = Math.floor(position - mins * 60);

    if (mins < 10) {
        mins = "0" + mins;
    }

    if (secs < 10) {
        secs = "0" + secs;
    }

    return mins + ":" + secs;
}

function getConfig() {
    return {
        apiKey: "ECLJI0GPBJVEXSZDT",
        spotifySpace: "id:spotifyv2-ZZ",
        echoNestHost: "http://developer.echonest.com/api/v4/"
    };
}
