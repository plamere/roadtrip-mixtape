var minArtistsPerPoint = 5;
var minutesPerPlaylist = 15;
var maxArtistsPerCity = 40;
var desiredArtistsPerLocationPlaylist = 10;
var kmPerMiles = 0.621371192;

var currentPoints = [];
var curPoint = 0;
var selected = 0;

jQuery.ajaxSettings.traditional = true;

var cities;
var city_subset;
var cityArtists = {}
var directionsDisplay;
var directionsService = new google.maps.DirectionsService();
var map;
var artistInfo = {};
var currentLocation;

function initialize() {
    initPlayer();
    setPlaying(false);
    $.getJSON('locations',  function(data) {
        cities = data;
        console.log('cities', cities);
        drawMap();
    });
}

function error(msg) {
    $("#error").text(msg);
}

function drawMap() {
    initCities();
    directionsDisplay = new google.maps.DirectionsRenderer({suppressMarkers:true});
    var center = new google.maps.LatLng(42.358, -71.056);
    var myOptions = {
      zoom:7,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      center: center
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
    google.maps.event.addListener(map, 'click', function(event) {
        track('mapClicked', 'nearby');
        playNearby(event.latLng);
    });
    directionsDisplay.setMap(map);
    calcRoute();
}


function initCities() {
    for (var i = 0; i < cities.length; i++) {
        var city = cities[i];
        city.latlng = new google.maps.LatLng(city.lat, city.lng);
    }
}
  
function fetchCityArtistsForPlaylist(points, ids) {
    ids = filterCityIds(ids);
    $.getJSON('artists',  { id:ids.join('_'), count: maxArtistsPerCity}, function(data) {
        processCityData(data);
        assignArtistsToWaypoints(points, data);
        showTripInfo(points);
    });
}

function tripDensity(points) {
    var sum = 0;
    var artists = 0;
    for (var i = 0; i < points.length; i++) {
        var ploc = points[i].latlng;
        for (var j = 0; j < points[i].info.length; j++) {
            var city = points[i].info[j].city;
            var dist = distance(city.latlng, ploc);
            sum += dist *  points[i].info[j].artists.length;
            artists += points[i].info[j].artists.length;
        }
    }
    if (artists > 0) {
        return sum / artists;
    } else {
        return -1;
    }
}


function showTripInfo(points) {
    var start = document.getElementById("start").value;
    var end = document.getElementById("end").value;
    $("#tt-start").text(start);
    $("#tt-end").text(end);

    var density = Math.round(tripDensity(points));
    var cities = 0;
    var artists = 0;
    for (var i = 0; i < points.length; i++) {
        cities += points[i].info.length;
        for (var j = 0; j < points[i].info.length; j++) {
            artists += points[i].info[j].artists.length;
        }
    }

    if (points.length > 0) {
        var first = points[0];
        var last = points[points.length - 1];
        $("#tt-distance").text(Math.round(last.distance) + " miles");
        $("#tt-time").text(fmtTime(last.time) + "");
        $("#tt-cities").text(cities);
        $("#tt-artists").text(artists);
        $("#tt-legs").text(points.length);
        if (density >= 0) {
            $("#tt-density").text(density + " miles");
        } else {
            $("#tt-density").text(" too far");
        }
    }
}


function filterCityIds(ids) {
    var oid = [];

    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (! (id in cityArtists)) {
            oid.push(id);
        }
    }
    return oid;
}


function fetchCityArtistsForNearby(cities, pos) {
    var ids = [];

    for (var i = 0; i < cities.length; i++) {
        ids.push(cities[i].city_id);
    }

    ids = filterCityIds(ids);
    if (ids.length > 0) {
        $.getJSON('artists',  { id:ids.join('_'), count: maxArtistsPerCity}, function(data) {
            processCityData(data);
            showNearbyOverlay(cities, pos);
        });
    } else {
        showNearbyOverlay(cities, pos);
    }
}



function processCityData(data) {
    for (var i = 0; i < data.length; i++) {
        var pi = data[i];
        var city = pi.city;
        var artists = pi.artists;
        for (var j = 0; j < artists.length; j++) {
            var ainfo = { city: city, artist: artists[j]};
            artistInfo[artists[j].artist_id] = ainfo;
            artists[j].curSongIndex = 0;
        }
        city.latlng = new google.maps.LatLng(city.lat, city.lng);
        cityArtists[city.city_id] = artists;
    }
}


function assignArtistsToWaypoints(points, data) {
    var skipArtists = {};


    for (var i = 0; i < points.length; i++) {
        var dcities = findNearestCities(points[i].latlng);
        var ac = 0;
        var pointInfo = [];
        for (var j = 0; ac < minArtistsPerPoint && j < dcities.length; j++) {
            var city = dcities[j][1];
            var artists = cityArtists[city.city_id];
            var partists = [];
            for (var k = 0; ac < minArtistsPerPoint && k < artists.length; k++) {
                var artist = artists[k];
                if (! (artist.artist_id in skipArtists) ) {
                    skipArtists[artist.artist_id] += 1;
                    partists.push(artist);
                    ac += 1;
                }
            }
            if (partists.length > 0) {
                var pi = {city: city, artists: partists };
                pointInfo.push(pi);
            }
        }
        points[i].info = pointInfo;
    }
}

function distance(latlng1, latlng2) {
    var pi = Math.PI;
    var R = 6371; // km
    var lat1 = latlng1.lat() * pi / 180.0;
    var lng1 = latlng1.lng() * pi / 180.0;
    var lat2 = latlng2.lat() * pi / 180.0;
    var lng2 = latlng2.lng() * pi / 180.0;
    var dLat = lat2 - lat1;
    var dLon = lng2 - lng1;

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d * kmPerMiles;
}

function slow_distance(latlng1, latlng2) {
    return google.maps.geometry.spherical.computeDistanceBetween(latlng1, latlng2);
}


function findNearbyCities(latlng, radius, allCities) {
    var results = []
    var cityList = getCityList(allCities);

    for (var i = 0; i < cityList.length; i++) {
        var city = cityList[i];
        var dist = distance(latlng, city.latlng);
        if (dist <= radius) {
            results.push(city);
        }
    }
    return results;
}

function getCityList(allCities) {
    var cityList = city_subset;
    if (allCities === true) {
        cityList = cities;
    }
    return cityList;
}

function findNearestCities(latlng, allCities) {
    var cityList = getCityList(allCities);
    var results = []
    for (var i = 0; i < cityList.length; i++) {
        var city = cityList[i];
        var dist = distance(latlng, city.latlng);
        results.push( [dist, city]);
    }
    results.sort(function(a,b) { return a[0] - b[0] } );
    return results;
}

function findNearestCity(latlng, allCities) {
    var closest = null;
    var closest_dist = 0;
    var cityList = getCityList(allCities);

    for (var i = 0; i < cityList.length; i++) {
        var city = cityList[i];
        var dist = distance(latlng, city.latlng);
        if (closest == null || dist < closest_dist) {
            closest_dist = dist;
            closest = city;
        }
    }
    return closest;
}



var markers = [];
var infowindow = new google.maps.InfoWindow();

function addCityMarker(city) {
    var marker = new google.maps.Marker({position:city.latlng, title:city.city + ', artists: ' + city.artists});
    markers.push(marker);
    marker.setMap(map);
}

function clearAllMarkers() {
    for (var i in markers) {
        markers[i].setMap(null);
    }
    markers = [];
}
  
var nearbyMarkers = [];

function clearNearbyMarkers() {
    for (var i in nearbyMarkers) {
        nearbyMarkers[i].setMap(null);
    }
    nearbyMarkers = [];
}

function addNearbyCityMarker(city) {
    var marker = new google.maps.Marker({icon:'assets/city_marker.png', position:city.latlng, title:city.city + ', artists: ' + city.artists});
    markers.push(marker);
    marker.setMap(map);
    nearbyMarkers.push(marker);
}

function addMarker(point, cities) {
    var title ='nowhere';
    if (cities.length > 0) {
        title = cities[0].city;
    }
    var marker = new google.maps.Marker({icon:'assets/green_dot.png', position:point.latlng, title:title});
    markers.push(marker);
    marker.setMap(map);
    google.maps.event.addListener(marker, 'click', function() {
        if (point.which in currentPoints) {
            track('click', 'route-point');
            showPointInfoOverlay(marker, point.which);
        }
    });

}

function playNearby(pos) {
    var cities = getNearbyCitiesWithNumArtists(pos, desiredArtistsPerLocationPlaylist);
    fetchCityArtistsForNearby(cities, pos);
    currentLocation = { pos: pos, cities: cities };
}


function playCurrentLocation() {
    var alist = [];
    if (currentLocation) {
        for (var i = 0; i < currentLocation.cities.length; i++) {
            var city = currentLocation.cities[i];
            var artists = cityArtists[city.city_id];
            for (var j = 0; j < artists.length; j++) {
                var artist = artists[j];
                if (alist.length < desiredArtistsPerLocationPlaylist) {
                    alist.push(artist);
                } else {
                    break;
                }
            }
        }
        var title = 'Music near selected point';
        clearQueue();
        shuffle(alist);
        for (var i = 0; i < alist.length; i++) {
            queueNextSongForArtist(alist[i]);
        }
        track('playCurrentLocation', currentLocation.cities[0].city);
    }
}


function queueNextSongForArtist(artist) {
    console.log('queueArtist', artist);
    queueArtist(artist, function() { artistPlayed(artist.artist_id); } );
}

function showNearbyOverlay(cities, pos) {
    console.log('SNO', cities, pos);
    var contents = "";
    var totalArtists = 0;
    contents += "<div class='overlay-info'>";
    clearNearbyMarkers();
    for (var i = 0; i < cities.length; i++) {
        var city = cities[i];
        addNearbyCityMarker(city);
        var artists = cityArtists[city.city_id];
        contents += "<b>" + city.city + "</b>";
        contents += "<ul>";

        console.log('SNOA', artists);
        for (var j = 0; j < artists.length; j++) {
            contents += "<li>  " + artists[j].name;
            totalArtists += 1;
            if (totalArtists >= desiredArtistsPerLocationPlaylist) {
                var delta = artists.length - (j + 1);
                if (delta > 1) {
                    contents += "<li>  <i> Plus many more artists</i>";
                }
                break;
            }
        }
        contents += "</ul>";
        contents += "<p>";
    }
    contents += "</div>";
        contents += "<button onclick='playCurrentLocation()'>Hear here</button>";
    contents += "</div>";
    infowindow.close();
    infowindow.setContent(contents);
    infowindow.setPosition(pos);
    infowindow.open(map);
        //showCityMarkers(pointInfo);
}


function getNearbyCitiesWithNumArtists(pos, minArtists) {
    var cities = [];
    var nearestCities = findNearestCities(pos, true);
    var sumArtists = 0;


    for (var i = 0; i < nearestCities.length; i++) {
        var city = nearestCities[i][1];
        cities.push(city);
        sumArtists += city.artists;
        if (sumArtists >= minArtists) {
            break;
        }
    }
    return cities;
}

function selectLegMarker(which) {
    if (selected in markers) {
        markers[selected].setIcon('assets/green_dot.png');
    }

    if (which in markers) {
        markers[which].setIcon('assets/red_dot.png');
    }
    selected = which;
}


function getAllArtistsInPath() {
    var allArtists = [];
    _.each(currentPoints, function(point) {
        _.each(point.info, function(info) {
            _.each(info.artists, function(artist) {
                allArtists.push(artist);
            });
        });
    });
    return allArtists;
}

function playPoint(which) {
    curPoint = which;
    selectLegMarker(which);
    var artists = [];
    for (var i = 0; i < currentPoints[which].info.length; i++) {
        var pi = currentPoints[which].info[i];
        for (var j = 0; j < pi.artists.length; j++) {
            artists.push(pi.artists[j]);
        }
    }
    var title = 'Music near ' + currentPoints[which].info[0].city.city;
    track('playPoint', currentPoints[which].info[0].city.city);
    clearQueue();
    shuffle(artists);
    console.log('playPoint', title, artists);
    playInSpotify(title, artists);
}

function needMoreSongs() {
    if (curPoint < currentPoints.length - 1) {
        playPoint(curPoint + 1);
    }
}

function playAllPoints() {
    playPoint(0);
}

function makePlaylist() {
    playAllPoints();
    track('playAllPoints', null);
}


function randomIndex(arry) {
    return Math.floor(Math.random() * arry.length);
}

function shuffle(arry) {
    for (var i = 0; i < arry.length; i++) {
        var ri = randomIndex(arry)
        var tmp = arry[i];
        arry[i] = arry[ri];
        arry[ri] = tmp;
    }
}

function playInSpotify(title, artists) {
    console.log('play in spotify', title, artists);
    var duration = 0;
    var secsPerPlaylist = minutesPerPlaylist * 60;
    while (duration < secsPerPlaylist) {
        for (var i = 0; i < artists.length; i++) {
            var artist = artists[i];
            var dur = queueArtist(artist, function() { artistPlayed(artist); } );
            duration += dur;
            if (duration >= secsPerPlaylist) {
                break;
            }
        }
    }
}

function artistPlayed(artist) {
    var ainfo = artistInfo[artist.artist_id];
    $("#artist-city").html(ainfo.city.city);
    clearNearbyMarkers();
    addNearbyCityMarker(ainfo.city);
}



function showPointInfoOverlay(marker, which ) {
        var cp = currentPoints[which];
        var pointInfo = cp.info;
        var contents = "";
        var start = document.getElementById("start").value;

        contents += "<div class='overlay'>";
        contents += "<h2> Leg " + (which + 1) + "</h2>";
        contents += "<div class='overlay-info'>";
        contents +=  'Distance from start: ' + Math.round(cp.distance)  +" miles<br>";
        contents +=  'Time from start: ' + fmtTime(cp.time)  + "<br>";
        contents += "</div>";
        contents += "<div class='overlay-info'>";
        if (pointInfo.length > 0) {
            for (var i = 0; i < pointInfo.length; i++) {
                var pi = pointInfo[i];
                contents += "<b>" + pi.city.city + "</b>";
                contents += "<ul>";
                for (var j = 0; j < pi.artists.length; j++) {
                    contents += "<li>  " + pi.artists[j].name;
                }
                contents += "</ul>";
                contents += "<p>";
            }
            contents += "</div>";
            contents += "<button onclick='playPoint( " + which  + " )'>Play this leg</button>";
        } else {
            contents = "Woah, we've played all the nearby music, there's nothing left. <br> Time to listen to a podcast I guess.";
        }
        contents += "</div>";
        infowindow.setContent(contents);
        infowindow.open(map, marker);
        showCityMarkers(pointInfo);
}

function showCityMarkers(pointInfo) {
    clearNearbyMarkers();
    for (var i = 0; i < pointInfo.length; i++) {
        var pi = pointInfo[i];
        addNearbyCityMarker(pi.city);
    }
}

function showFullPlaylist(points) {
    var spot = $("#full-playlist");
    spot.empty();
    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        console.log('leg', i);
        console.log(points[i]);
        var leg = $("<div>", { 'class' : 'leg-div' } );
        var legHeader = $("<div class='leghead'>");
        legHeader.html('Leg ' + (i + 1));
        leg.append(legHeader);
        leg.append('<p>Distance from start: ' + Math.round(p.distance) + ' miles');
        leg.append('<p>Travel time: ' + fmtTime(p.time));
        leg.append('<p>Speed: ' + Math.round(p.speed) + ' mph');
        spot.append(leg);

        for (var j = 0; j < p.info.length; j++) {
            var info = p.info[j];
            var city = info.city.city;
            for (var k = 0; k < info.artists.length; k++) {
                var artist = info.artists[k];
                var ae = $("<div>");
                ae.append("<div class='pl-artist-name'>"  + artist.name +"</div>");
                ae.append("<div class='pl-city'>" + city + "</div>");
                leg.append(ae);
            }
        }
    }
}

function mtof(m) {
    return Math.round(m * 5280);
}

function metersToMile(m) {
    return m / 1000. * kmPerMiles;
}

function pad(num, length) {
    var s = num.toString()
    while (s.length < length) {
        s = '0' + s
    }
    return s
}


function fmtTime(time) {
    if (isNaN(time)) {
        return '';
    } else {
        time = Math.round(time)
        var hours = Math.floor(time / 3600)
        time = time - hours * 3600
        var mins =  Math.floor(time / 60)
        var secs = time - mins * 60
        return pad(hours, 2) + ':' + pad(mins, 2) + ':' + pad(secs, 2);
    }
}

function reportLegStats(ll) {
   var last = ll[0];
   var minDist = 1000000;
   var maxDist = 0;
   var sumDist = 0;


   for (var i = 1; i < ll.length; i++) {
        var dist = distance(last, ll[i]);

        sumDist += dist;
        if (dist < minDist) {
            minDist = dist;
        }

        if (dist > maxDist) {
            maxDist = dist;
        }
        last = ll[i];
   }
   console.log('  ls', 'min', mtof(minDist), 'max', mtof(maxDist), 'avg', mtof(sumDist / (ll.length - 1)), 'tot', sumDist);
}



function showTrip(currentRoute) {
    if (currentRoute == null) {
        console.log('no route');
    } else {
        if (currentRoute.legs.length != 1) {
            console.log('unexpected leg size');
        } else {
            var leg = currentRoute.legs[0];
            console.log(leg);
            console.log('distance', leg.distance.text);
            console.log('duration', leg.duration.text);
            console.log('steps', leg.steps.length);
            for (var i = 0; i < leg.steps.length; i++) {
                var step = leg.steps[i];
                console.log('step', i, 'distance', step.distance.text, 'duration', 
                    step.duration.text, 'latlngs', step.lat_lngs.length, 'm/ll',  Math.round(step.distance.value / step.lat_lngs.length));
                reportLegStats(step.lat_lngs);
            }
        }
    }
}

  // generate a list of latlngs that are
  // roughly timePerPoint time apart.

function genPoints(route, timePerPoint) {
    var leg = route.legs[0];
    var points = [];
    var last = null;
    var ctime = 0;
    var ttime = 0;
    var tdist = 0

    for (var i = 0; i < leg.steps.length; i++) {
        var step = leg.steps[i];
        var speed = metersToMile(step.distance.value) / (step.duration.value / 3600.0);
        for (var j = 0; j < step.lat_lngs.length; j++) {
            var pos = step.lat_lngs[j];
            if (last == null) {
                var point = {
                    latlng: pos,
                    time:ttime,
                    distance:tdist,
                    speed:speed,
                    which: points.length
                }
                points.push(point);
                ctime = 0;
            } else {
                var dist = distance(pos, last);
                var dtime = 3600 * dist / speed;
                ctime += dtime;
                ttime += dtime;
                tdist += dist;

                if (ctime > timePerPoint) {
                    var point = {
                        latlng: pos,
                        time:ttime,
                        distance:tdist,
                        speed:speed,
                        which: points.length
                    }
                    points.push(point);
                    ctime = 0;
                }
            }
            last = pos;
        }
    }

    if (ctime > 0) {
        var point = {
            latlng: pos,
            time:ttime,
            distance:tdist,
            speed:speed,
            which: points.length
        }
        points.push(point);
    }
    return points;
}

function getNearbyCities(latlng, minArtists, skip) {
    var dcities = findNearestCities(latlng);
    var ac = 0;
    var rcities = [];
    for (var i = 0; i < dcities.length; i++) {
        var city = dcities[i][1];
        if (! (city.city_id in skip)) {
            rcities.push(city);
            ac += city.artists;
            if (ac >= minArtists) {
                break;
            }
        } else {
        }
    }
    return rcities;
}


function buildPlaylist(points) {
    clearAllMarkers();
    cityArtists = {}
    var skipCities = {};
    var ids = [];
    for (var i = 0; i < points.length; i++) {
        var pos = points[i].latlng;
        var cities = getNearbyCities(pos, minArtistsPerPoint, skipCities);
        var ac = 0;
        for (var j = 0; j < cities.length; j++) {
            var city = cities[j];
            ac += city.artists;
            ids.push(city.city_id);
            skipCities[city.city_id] = 1;
        }
        addMarker(points[i], cities);
    }
    fetchCityArtistsForPlaylist(points, ids);
}


function generatePlaylist(currentRoute) {
    selected = 0;
    curPoint = 0;
    currentPoints = genPoints(currentRoute, 60 * minutesPerPlaylist);
    if (currentPoints.length > 500) {
        error("Woah! That is too long for a playlist. Get some podcasts instead.");
    } else {
        buildPlaylist(currentPoints);
    }
}


function subsetCities(bounds) {
    var subset = [];
    for (var i = 0; i < cities.length; i++) {
        var city = cities[i];
        if (bounds.contains(city.latlng)) {
            subset.push(city);
        }
    }
    return subset;
}

function getFullPath(route) {
    var path  = [];

    path.push(route.legs[0].start_location);

    for (var i = 0; i < route.overview_path.length; i++) {
        path.push(route.overview_path[i]);
    }
    path.push(route.legs[route.legs.length - 1].end_location);
    return path;
}


function expandBounds(b) {
    var sw = new google.maps.LatLng(b.getSouthWest().lat() -1, b.getSouthWest().lng() - 1);
    var ne = new google.maps.LatLng(b.getNorthEast().lat() +1, b.getNorthEast().lng() + 1);
    return new google.maps.LatLngBounds(sw, ne);
}

function calcRoute() {
    var start = document.getElementById("start").value;
    var end = document.getElementById("end").value;
    var request = {
        origin:start, 
        destination:end,
        travelMode: google.maps.DirectionsTravelMode.DRIVING
    };
    error("");
    track('route', start +  ' - ' + end);
    directionsService.route(request, function(response, status) {
      if (status == google.maps.DirectionsStatus.OK) {
        directionsDisplay.setDirections(response);
        var currentRoute = response.routes[0];
        var bounds = expandBounds(response.routes[0].bounds);
        city_subset = subsetCities(bounds);
        generatePlaylist(currentRoute);
      } else {
            track('error', status);
            error("Can't find that route");
      }
    });
}

function setPlaying(playing) {
    if (playing) {
        paused = false;
       $('#pause').css("background-image", "url(assets/Pause_StackedButton2.png)");
    } else {
        paused = true;
       $('#pause').css("background-image", "url(assets/Play_StackedButton2.png)");
    }
}

function getPlaylistTitle() {
    var start = $("#start").val();
    var end = $("#end").val();
    return "From " + toTitleCase(start) + " to " + toTitleCase(end) + " - a Roadtrip Mixtape";
}

function getCurTracks(callback) {
    var artists = getAllArtistsInPath();
    getSpotifyTrackIdsForArtists(artists, callback);
}

function getSpotifyTrackIdsForArtists(artists, callback) {
    var sids = [];
    _.each(artists, function(artist) {
        sids.push('spotify:track:' + artist.songs[artist.curSongIndex].tid);
    });
    callback(sids);
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}


function savePlaylist() {
    getCurTracks(function(spotifyTracks) {
        var title = getPlaylistTitle();
        console.log('savePlaylist', title, spotifyTracks);
        var client_id = '';
        var redirect_uri = '';

        console.log('location.host', location.host);
        if (location.host == 'localhost:8778') {
            client_id = 'bd17bb97832c44b28f4336c710fda877';
            redirect_uri = 'http://localhost:8778/CityServer/callback.html';
        } else {
            client_id = '64c58b215d9d4e8caf3744e4592cf9ce';
            redirect_uri = 'http://labs.echonest.com/CityServer/callback.html';
        }

        console.log('redirect ...', redirect_uri);

        var url = 'https://accounts.spotify.com/authorize?client_id=' + client_id +
            '&response_type=token' +
            '&scope=playlist-modify-private' +
            '&redirect_uri=' + encodeURIComponent(redirect_uri);
        localStorage.setItem('createplaylist-tracks', JSON.stringify(spotifyTracks));
        localStorage.setItem('createplaylist-name', title);
        var w = window.open(url, 'asdf', 'WIDTH=400,HEIGHT=500');
    });
}


function track(action, label) {
    _gaq.push( ['_trackEvent', 'roadtrip', action, label]);
}
