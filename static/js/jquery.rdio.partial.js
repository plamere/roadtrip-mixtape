/*!	rdio.jquery v0.1 <http://developer.rdio.com/>
	is released under the MIT License <http://www.opensource.org/licenses/mit-license.php>
	Copyright 2011 Rdio Inc.
*/

(function($) {
  $.fn.rdio = function jQuery_fn_rdio(playbackToken) {
    var container = $(this);
    var rdio = container.data('rdio');
    if (rdio != undefined) {
      return rdio;
    }
    // create an ID for the EMBED / OBJECT
    var id = 'rdio_swf_'+Math.floor(Math.random()*10000);
    // add a placeholder that SWFObject will replace
    $('<div></div>').attr('id', id).prependTo(container);

    // create a name for the listener
    var listener_name = id + '_cb';
    // build a listener that turns callbacks into jQuery events
    var listener = {};
    listener.ready = function(userInfo) { container.trigger('ready.rdio', [userInfo])};
    listener.playStateChanged = function(playState) { container.trigger('playStateChanged.rdio', [playState])};
    listener.playingTrackChanged = function(playingTrack, sourcePosition) { container.trigger('playingTrackChanged.rdio', [playingTrack, sourcePosition])};
    listener.playingSourceChanged = function(playingSource) { container.trigger('playingSourceChanged.rdio', [playingSource])};
    listener.volumeChanged = function(volume) { container.trigger('volumeChanged.rdio', [volume])};
    listener.muteChanged = function(mute) { container.trigger('muteChanged.rdio', [mute])};
    listener.positionChanged = function(position) { container.trigger('positionChanged.rdio', [position])};
    listener.queueChanged = function(newQueue) { container.trigger('queueChanged.rdio', [newQueue])};
    listener.shuffleChanged = function(shuffle) { container.trigger('shuffleChanged.rdio', [shuffle])};
    listener.repeatChanged = function(repeat) { container.trigger('repeatChanged.rdio', [repeat])};
    listener.updateFrequencyData = function(frequencyData) { container.trigger('updateFrequencyData.rdio', [frequencyData])};
    listener.playingSomewhereElse = function() { container.trigger('playingSomewhereElse.rdio')};
    listener.freeRemainingChanged = function(remaining) { container.trigger('freeRemainingChanged.rdio', [frequencyData])};
    window[listener_name] = listener;

    // get SWFObject to embed the playback SWF
    var flashvars = {
      'playbackToken': playbackToken,
      'domain': document.domain,
      'listener': listener_name
    };
    var params = {'allowScriptAccess': 'always'};
    var attributes = {};
    var o = {'embed': null};
    swfobject.embedSWF('http://www.rdio.com/api/swf/', id, 1, 1, '9.0.0', '', flashvars, params, attributes, function(status) {o.embed = $('#'+id).get(0);});

    // build a wrapper object to dispatch method calls into the SWF
    o.play = function(key, options) { this.embed.rdio_play(key, options); };
    o.pause = function() { this.embed.rdio_pause(); };
    o.stop = function() { this.embed.rdio_stop(); };
    o.next = function(superSkip) { this.embed.rdio_next(superSkip); };
    o.previous = function() { this.embed.rdio_previous(); };
    o.seek = function(position) { this.embed.rdio_seek(position); };
    o.setShuffle = function(shuffle) { this.embed.rdio_setShuffle(shuffle); };
    o.setRepeat = function(mode) { this.embed.rdio_setRepeat(mode); };
    o.queue = function(key, options) { this.embed.queue(key, options); };
    o.setVolume = function(volume) { this.embed.rdio_setVolume(volume); };
    o.setMute = function(mute) { this.embed.rdio_setMute(mute); };
    o.playQueuedTrack = function(position, offset) { this.embed.rdio_playQueuedTrack(position, offset); };
    o.moveQueuedSource = function(from, to) { this.embed.rdio_moveQueuedSource(from, to); };
    o.clearQueue = function() { this.embed.rdio_clearQueue(); };
    o.setCurrentPosition = function(sourceIndex) { this.embed.rdio_setCurrentPosition(sourceIndex); };
    o.removeFromQueue = function(sourceIndex) { this.embed.rdio_removeFromQueue(sourceIndex); };
    o.sendState = function() { this.embed.rdio_sendState(); };
    o.startFrequencyAnalyzer = function(options) { this.embed.rdio_startFrequencyAnalyzer(options); };
    o.stopFrequencyAnalyzer = function() { this.embed.rdio_stopFrequencyAnalyzer(); };

    // store it on the container element
    container.data('rdio', o);

    return o;
  }

})(jQuery);
