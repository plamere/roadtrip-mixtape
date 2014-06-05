import os 
import cherrypy
import ConfigParser
import urllib2
import simplejson as json
import webtools
import collections
import sys


class CityServer(object):
    def __init__(self, config):
        self.production_mode = config.getboolean('settings', 'production')
        self.city_info = {}
        self.city_locations = []
        self.artists_by_city = collections.defaultdict(list)

        self.city_id_count = 0
        self.city_ids = {}

        self.load_city_locations()
        self.load_artist_locations()
        self.filter_city_locations()
        self.location_js = None

    def artists(self, id='', count='10', callback=None, _=''):
        if callback:
            cherrypy.response.headers['Content-Type']= 'text/javascript'
        else:
            cherrypy.response.headers['Content-Type']= 'application/json'

        count = int(count)
        ids = get_param_as_list(id)

        results = []
        for id in ids:
            results.append( self.get_artist_info(id, count) )
        return webtools.to_json(results, callback)
    artists.exposed = True

    def get_artist_info(self, id, count):
        info = {}
        info['city_id'] = id
        if id in self.artists_by_city:
            info['artists'] = self.artists_by_city[id][:count]
            info['city'] = self.city_info[id]
        return info
            

    def locations(self, callback=None, _=''):
        if callback:
            cherrypy.response.headers['Content-Type']= 'text/javascript'
        else:
            cherrypy.response.headers['Content-Type']= 'application/json'

        if  not self.location_js:
            self.location_js = json.dumps(self.city_locations) 

        results = self.location_js
        if callback:
            results = callback + "(" + results + ")"
        return results
    locations.exposed = True

    def load_city_locations(self):
        for line in open('data/filtered_geo.dat'):
            city, fcity, lat, lng = line.strip().split(' <sep> ')
            if len(city.split(',')) >= 2:
                city_id = self.get_city_id(city)
                entry = { 'city': city, 'city_id' : city_id, 'lat' : lat, 'lng' : lng, 'artists' : 0}
                self.city_info[norm_city(city)] = entry
                self.city_info[city_id] = entry
                self.city_locations.append(entry)
            else:
                #print 'bad', city
                pass


    def filter_city_locations(self):
        filtered = []
        for city in self.city_locations:
            if city['artists'] > 0:
                filtered.append(city)
        print 'filtered', len(self.city_locations), 'to', len(filtered), 'locations'
        self.city_locations = filtered


    def load_artist_locations(self):
        # asongs = self. load_songs('songs.dat')
        acount = 0
        missing = 0
        bad_city = 0
        for line in open('data/filtered_loc.dat'):
            fields  = line.strip().split(' <sep> ')
            if len(fields) == 4:
                id, artist, hot, city = fields
                if self.is_valid_city(city):
                    artist = { 'name' : artist, 'hotttnesss' : hot, 'artist_id': id, 'songs' : [] }
                    city_id = self.get_city_id(city)
                    self.artists_by_city[city_id].append(artist)
                    acount += 1
                else:
                    bad_city += 1

        for k, v in self.artists_by_city.items():
            v.sort(key=lambda a: a['hotttnesss'], reverse=True)
            if k in self.city_info:
                city = self.city_info[k]
                city['artists'] = len(v)
            else:
                print 'no city info for', k, len(v)
               

        print 'cities', len(self.artists_by_city), 'artists', acount, 'missing', missing, 'invalid city', bad_city



    def is_valid_city(self, city):
        nc = norm_city(city)
        return nc in self.city_ids

    def get_city_id(self, city):
        nc = norm_city(city)
        if not nc in self.city_ids:
            self.city_ids[nc] = hex(self.city_id_count)[2:]
            self.city_id_count += 1
        return self.city_ids[nc]

def norm_city(c):
    return c.lower()

def to_json(dict, callback=None):

    def encode_frozenset(obj):
        if isinstance(obj, frozenset):
            return list(obj)
        raise TypeError(repr(obj) + ' is not JSON Serializable')

    results =  json.dumps(dict, sort_keys=True, indent = 4, default=encode_frozenset) 
    if callback:
        results = callback + "(" + results + ")"
    return results

def get_param_as_list(param):
    if not param:
        param = []
    if not isinstance(param, list):
        fields =  param.split('_')
        if len(fields) > 1:
            param = fields
        else:
            param = [param]
    return param



if __name__ == '__main__':
    urllib2.install_opener(urllib2.build_opener())


    conf_path = os.path.abspath('web.conf')
    print 'reading config from', conf_path
    cherrypy.config.update(conf_path)


    config = ConfigParser.ConfigParser()
    config.read(conf_path)
    production_mode = config.getboolean('settings', 'production')

    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Set up site-wide config first so we get a log if errors occur.

    if production_mode:
        print "Starting in production mode"
        cherrypy.config.update({'environment': 'production',
                                'log.error_file': 'simdemo.log',
                                'log.screen': True})
    else:
        print "Starting in development mode"
        cherrypy.config.update({'noenvironment': 'production',
                                'log.error_file': 'site.log',
                                'log.screen': True})

    conf = webtools.get_export_map_for_directory("static")
    cherrypy.quickstart(CityServer(config), '/CityServer', config=conf)

