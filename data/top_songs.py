#ARODZUF11F4C841E1F <sep> Drake <sep> 0.808618 <sep> Toronto, Ontario, CA <sep> spotify:artist:2m5ti7YuYYCVs8xfZgnVkxp
#AR03BDP1187FB5B324 <sep> Britney Spears <sep> 10 <sep> rdio-US:track:t2902301,205;rdio-US:track:t2899255,216;rdio-US:track:t2901891,223;rdio-US:track:t2891396,292;rdio-US:track:t1750026,192;rdio-US:track:t2901971,263;rdio-US:track:t8170683,225;rdio-US:track:t2905242,452;rdio-US:track:t3777400,224;rdio-US:track:t2905545,213

import sys
import spotipy

sp = spotipy.Spotify()


def short_sid(sid):
    return sid.split(':')[2]

def go(start=0):
    missing = 0
    for which, line in enumerate(open('spotify_ids.dat')):
        if which < start:
            continue
        fields = line.strip().split(' <sep> ')
        if len(fields) == 5:
            aid, name, hot, city, said = fields
            said = short_sid(said)
            try:
                response = sp.artist_top_tracks(said)
                tracks = response['tracks']
                if len(tracks) > 0:
                    sids = []
                    for t in tracks[:5]:
                        duration = t['duration_ms'] / 1000
                        sid = short_sid(t['uri'])
                        ssid = sid + ':' + str(duration)
                        sids.append(ssid)
                    ssids = ';'.join(sids)
                    print ' <sep> '.join( [aid, said, name, hot, city, ssids])
                else:
                    missing += 1
                    print >>sys.stderr, 'missing', name, aid, said
            except spotipy.SpotifyException:
                    print >>sys.stderr, 'trouble with', name, aid, said
                
                 
        print >> sys.stderr, missing, which, name

if __name__ == '__main__':
    start = 0
    if len(sys.argv) > 1:
        start = int(sys.argv[1])
    go(start)
