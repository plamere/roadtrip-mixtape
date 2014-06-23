import sys
import pyen
en = pyen.Pyen()

def go(start = 0):
    missing = 0
    for which, line in enumerate(open('filtered_loc.dat')):
        if which >= start:
            fields = line.strip().split(' <sep> ')
            aid, aname, hot, city = fields
            response = en.get('artist/profile', id=aid, bucket='id:spotify')
            if 'artist' in response and 'foreign_ids' in response['artist'] and len(response['artist']['foreign_ids']) > 0:
                spid = response['artist']['foreign_ids'][0]['foreign_id']
            else:
                spid = ''
                missing += 1
            print ' <sep> '.join(fields + [spid])
            print >>sys.stderr, missing, which

go()
