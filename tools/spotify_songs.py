import sys
import pyen
import pprint

spotify = 'id:spotify-WW'

en = pyen.Pyen()

# ARY2Z6Y1187B9BA126 <sep> Scissor Sisters <sep> 10 <sep> rdio-US:track:t2760652,272;rdio-US:track:t2761451,235;rdio-US:track:t2761326,197;rdio-US:track:t2782630,157;rdio-US:track:t3890930,217;rdio-US:track:t2782677,302;rdio-US:track:t2761523,177;rdio-US:track:t3890675,187;rdio-US:track:t2782755,209;rdio-US:track:t3890777,185

def get_songs(aid):
    songs = []
    response = en.get('playlist/static', type='artist', results=5, artist_id=aid, bucket=[spotify, 'tracks', 'audio_summary'], limit=True)
    for song in response['songs']:
        duration = int(song['audio_summary']['duration'])
        sid = song["tracks"][0]["foreign_id"].split(':')[-1]
        songs.append( (sid, duration) )
        # pprint.pprint(song)
    return songs

for line in sys.stdin:
    fields = line.strip().split(' <sep> ')
    aid, aname = fields[0], fields[1]
    songs = get_songs(aid)
    song_strings = [ ','.join( (sid, str(dur)) ) for sid, dur in songs]
    print ' <sep> '.join( [aid, aname, str(len(songs)),  ";".join(song_strings)])

