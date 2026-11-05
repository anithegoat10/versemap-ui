'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import MapboxMap, {
  Marker,
  NavigationControl,
  Source,
  Layer,
  MapRef,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../utils/supabase';

interface NormalizedPin {
  id: string | number;
  title: string;
  artist: string;
  category: string;
  lat: number;
  lng: number;
  displayLat?: number;
  displayLng?: number;
  placeId: string;
  siteStatus: string;
  businessStatus: string;
  lyricOrContext: string;
  songOrAlbum: string;
  releaseYear: number | null;
  sceneTags: string[];
  rawQuery: string;
  exactVerseTimestamp?: string;
  exactVerseSeconds?: number;
  previewSeekSeconds?: number;
  wikiSlug?: string;
}

interface SongResolution {
  artist: string;
  song: string;
  album?: string;
  exactVerseTimestamp: string;
  exactVerseSeconds: number;
  previewSeekSeconds: number;
  wikiSlug?: string;
}

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const INITIAL_MAP_VIEW = {
  latitude: 40.0,
  longitude: -30.0,
  zoom: 2.2,
};

const DEFAULT_BOUNDS: ViewportBounds = {
  north: 85,
  south: -85,
  east: 180,
  west: -180,
};

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
};

const ROUTE_LINE_LAYOUT: any = {
  'line-join': 'round',
  'line-cap': 'round',
};

const ROUTE_GLOW_PAINT: any = {
  'line-color': '#f59e0b',
  'line-width': 9,
  'line-opacity': 0.28,
  'line-blur': 4,
};

const ROUTE_DASH_PAINT: any = {
  'line-color': '#fbbf24',
  'line-width': 3,
  'line-opacity': 0.95,
  'line-dasharray': [2, 2],
};

// Step 4.2: Only clusters are rendered in WebGL; unclustered pins render as custom HTML/SVG <Marker>s
const INTERACTIVE_LAYER_IDS = ['clusters'];
const CLUSTER_MAX_ZOOM = 13;
const CLUSTER_RADIUS_PX = 42;

const CLUSTER_FILTER: any = ['has', 'point_count'];

const CLUSTER_CIRCLE_PAINT: any = {
  'circle-color': [
    'step',
    ['get', 'point_count'],
    '#f59e0b',
    8,
    '#ec4899',
    25,
    '#a855f7',
  ],
  'circle-radius': ['step', ['get', 'point_count'], 19, 8, 24, 25, 30],
  'circle-stroke-width': 2.5,
  'circle-stroke-color': '#09090b',
};

const CLUSTER_COUNT_LAYOUT: any = {
  'text-field': '{point_count_abbreviated}',
  'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
  'text-size': 13,
};

const CLUSTER_COUNT_PAINT: any = {
  'text-color': '#09090b',
};

const ERA_PRESETS = [
  {
    id: 'ALL',
    label: 'All Eras (Global View)',
    description: 'All geocoded music history pins',
    center: { lat: 40.0, lng: -30.0, zoom: 2.2 },
  },
  {
    id: 'GREENWICH_VILLAGE',
    label: 'Greenwich Village Folk (1960–1966)',
    description: 'Bob Dylan & the NYC Folk Revival',
    center: { lat: 40.7308, lng: -74.0027, zoom: 13.5 },
  },
  {
    id: 'LAUREL_CANYON',
    label: 'Laurel Canyon & Sunset Strip (1967–1975)',
    description: 'The Eagles & Southern California Rock',
    center: { lat: 34.085, lng: -118.39, zoom: 10.5 },
  },
  {
    id: 'SWINGING_LONDON',
    label: 'Swinging & Psychedelic London (1965–1977)',
    description: 'The Beatles, Pink Floyd & Led Zeppelin',
    center: { lat: 51.52, lng: -0.15, zoom: 11.2 },
  },
];

const PIN_CATEGORIES = [
  { id: 'ALL', label: 'All Categories', color: '#f59e0b' },
  { id: 'LYRIC_MENTION', label: 'Lyric Mention', color: '#3b82f6' },
  { id: 'ALBUM_COVER', label: 'Album Cover', color: '#ec4899' },
  { id: 'HISTORIC_VENUE', label: 'Historic Venue', color: '#10b981' },
  { id: 'TRIBUTE_MURAL', label: 'Tribute / Mural', color: '#a855f7' },
];

const SUPPLEMENTAL_VERIFIED_PINS: NormalizedPin[] = [
  {
    id: 'dylan-cover-2',
    title: 'Bringing It All Back Home — Album Cover House',
    artist: 'Bob Dylan',
    category: 'ALBUM_COVER',
    lat: 42.0494,
    lng: -74.1322,
    placeId: '',
    siteStatus: 'LANDMARK_OR_PRIVATE',
    businessStatus: 'HISTORIC_SITE',
    lyricOrContext:
      'Shot by photographer Daniel Kramer at manager Albert Grossman’s stately home in Woodstock, NY. The staging surrounds Dylan and Grossman’s wife Sally with cultural artifacts—LP sleeves, magazines, and Dylan’s cat—marking the moment he plugged in and left acoustic orthodoxy behind.',
    songOrAlbum: 'Subterranean Homesick Blues',
    releaseYear: 1965,
    sceneTags: ['GREENWICH_VILLAGE'],
    rawQuery: 'Upper Byrdcliffe Rd, Woodstock, NY',
    wikiSlug: 'Bringing_It_All_Back_Home',
  },
  {
    id: 'dylan-cover-3',
    title: 'Highway 61 Revisited — Album Cover Steps (Gramercy Park)',
    artist: 'Bob Dylan',
    category: 'ALBUM_COVER',
    lat: 40.7376,
    lng: -73.9875,
    placeId: '',
    siteStatus: 'LANDMARK_OR_PRIVATE',
    businessStatus: 'INTACT_PUBLIC',
    lyricOrContext:
      'Photographed by Daniel Kramer on the brownstone stoop of 4 Gramercy Park West in Manhattan. Dylan scowls into the lens wearing his blue Triumph motorcycle T-shirt while friend Bob Neuwirth stands out of focus behind him holding a camera.',
    songOrAlbum: 'Highway 61 Revisited',
    releaseYear: 1965,
    sceneTags: ['GREENWICH_VILLAGE'],
    rawQuery: '4 Gramercy Park West, New York, NY',
    wikiSlug: 'Highway_61_Revisited',
  },
  {
    id: 'dylan-cover-4',
    title: 'Blonde on Blonde — Album Cover Location (Meatpacking District)',
    artist: 'Bob Dylan',
    category: 'ALBUM_COVER',
    lat: 40.7421,
    lng: -74.0079,
    placeId: '',
    siteStatus: 'INTACT_PUBLIC',
    businessStatus: 'INTACT_PUBLIC',
    lyricOrContext:
      'Jerry Schatzberg shot this famously blurred double-LP gatefold portrait outside a brick warehouse at West 14th Street and Ninth Avenue on a freezing February morning in 1966. Both Schatzberg and Dylan were shivering so hard in the wind that the resulting motion blur became rock history.',
    songOrAlbum: 'Visions of Johanna',
    releaseYear: 1966,
    sceneTags: ['GREENWICH_VILLAGE'],
    rawQuery: 'W 14th St & 9th Ave, New York, NY',
    wikiSlug: 'Blonde_on_Blonde',
  },
  {
    id: 'dylan-cover-5',
    title: 'John Wesley Harding — Album Cover Woods',
    artist: 'Bob Dylan',
    category: 'ALBUM_COVER',
    lat: 42.0409,
    lng: -74.1182,
    placeId: '',
    siteStatus: 'LANDMARK_OR_PRIVATE',
    businessStatus: 'HISTORIC_SITE',
    lyricOrContext:
      'Taken in the woods of Woodstock, NY after Dylan’s 1966 motorcycle crash forced him into seclusion. Photographer John Berg captured Dylan in a weathered coat flanked by visiting Bengali baul musicians Purna Das and Luxman Das alongside local carpenter Charlie Joy.',
    songOrAlbum: 'All Along the Watchtower',
    releaseYear: 1967,
    sceneTags: ['GREENWICH_VILLAGE'],
    rawQuery: 'Woodstock, NY',
    wikiSlug: 'John_Wesley_Harding',
  },
  {
    id: 'dylan-cover-6',
    title: 'Nashville Skyline — Album Cover Exterior (Columbia Studio B)',
    artist: 'Bob Dylan',
    category: 'ALBUM_COVER',
    lat: 36.1498,
    lng: -86.7932,
    placeId: '',
    siteStatus: 'INTACT_PUBLIC',
    businessStatus: 'OPERATIONAL',
    lyricOrContext:
      'Elliott Landy snapped Dylan smiling and tipping his hat outside Columbia’s Historic Studio B on Nashville’s Music Row in February 1969, signaling his warm country-crooner transformation and his historic duet sessions with Johnny Cash.',
    songOrAlbum: 'Lay Lady Lay',
    releaseYear: 1969,
    sceneTags: [],
    rawQuery: '34 Music Square E, Nashville, TN',
    wikiSlug: 'Nashville_Skyline',
  },
  {
    id: 'lyric-ashtabula',
    title: 'Ashtabula, Ohio ("You\'re Gonna Make Me Lonesome When You Go")',
    artist: 'Bob Dylan',
    category: 'LYRIC_MENTION',
    lat: 41.865,
    lng: -80.7898,
    placeId: '',
    siteStatus: 'INTACT_PUBLIC',
    businessStatus: 'INTACT_PUBLIC',
    lyricOrContext:
      'Immortalized on 1975’s Blood on the Tracks in "You’re Gonna Make Me Lonesome When You Go." Written as Dylan’s marriage was fracturing, the lyric nods to this Lake Erie port town in northeastern Ohio alongside Honolulu and San Francisco as places the narrator will look for his departing lover.',
    songOrAlbum: "You're Gonna Make Me Lonesome When You Go",
    releaseYear: 1975,
    sceneTags: [],
    rawQuery: 'Ashtabula, OH',
  },
  {
    id: 'lyric-bishopsgate',
    title: 'Bishopsgate, London ("Being for the Benefit of Mr. Kite!")',
    artist: 'The Beatles',
    category: 'LYRIC_MENTION',
    lat: 51.5165,
    lng: -0.0803,
    placeId: '',
    siteStatus: 'INTACT_PUBLIC',
    businessStatus: 'INTACT_PUBLIC',
    lyricOrContext:
      'While filming a promotional clip in Kent in January 1967, John Lennon bought an 1843 Pablo Fanque circus poster at an antique shop. He adapted the poster’s billing—including the Hendersons’ somersaults promised at Bishopsgate—into the swirling carnival centerpiece of Sgt. Pepper.',
    songOrAlbum: 'Being for the Benefit of Mr. Kite!',
    releaseYear: 1967,
    sceneTags: ['SWINGING_LONDON'],
    rawQuery: 'Bishopsgate, London, UK',
  },
];

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getHaversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

// Web Mercator pixel projection for zero-dependency unclustered pin detection
function projectToWorldPixels(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const worldSize = 512 * Math.pow(2, Math.floor(zoom));
  const x = ((lng + 180) / 360) * worldSize;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clampedSin = Math.max(-0.9999, Math.min(0.9999, sinLat));
  const y =
    (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * worldSize;
  return { x: x, y: y };
}

function isPinWithinBounds(lat: number, lng: number, bounds: ViewportBounds): boolean {
  const latMargin = 0.08;
  const lngMargin = 0.08;
  if (lat < bounds.south - latMargin || bounds.north + latMargin < lat) {
    return false;
  }
  if (bounds.west <= bounds.east) {
    return bounds.west - lngMargin <= lng && lng <= bounds.east + lngMargin;
  }
  return bounds.west - lngMargin <= lng || lng <= bounds.east + lngMargin;
}

function optimizeStopsNearestNeighbor(stops: NormalizedPin[]): NormalizedPin[] {
  if (stops.length <= 2) {
    return [...stops];
  }

  const startStop = stops[0];
  const unvisited = stops.slice(1);
  const ordered: NormalizedPin[] = [startStop];
  let current = startStop;

  while (unvisited.length !== 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i = i + 1) {
      const candidate = unvisited[i];
      const dist = getHaversineDistanceKm(
        current.lat,
        current.lng,
        candidate.lat,
        candidate.lng
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextStop = unvisited.splice(nearestIdx, 1)[0];
    ordered.push(nextStop);
    current = nextStop;
  }

  return ordered;
}

function calculateTotalRouteDistanceKm(stops: NormalizedPin[]): number {
  if (stops.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < stops.length - 1; i = i + 1) {
    total =
      total +
      getHaversineDistanceKm(
        stops[i].lat,
        stops[i].lng,
        stops[i + 1].lat,
        stops[i + 1].lng
      );
  }
  return total;
}

function normalizeAndFixCategory(title: string, rawCategory: string, artist: string): string {
  const lowerTitle = title.toLowerCase();
  const upperCat = (rawCategory || '').toUpperCase();

  if (lowerTitle.includes('abbey road') && artist.toLowerCase().includes('floyd')) {
    return 'HISTORIC_VENUE';
  }

  if (
    /britannia row|headley grange|columbia records|studio a|olympic studios|trident studios|gaslight|bitter end|cafe wha|gerde|cavern club|troubadour|ufo club|roundhouse/i.test(
      lowerTitle
    )
  ) {
    return 'HISTORIC_VENUE';
  }

  if (/kobra|mural/i.test(lowerTitle)) {
    return 'TRIBUTE_MURAL';
  }

  if (
    /giant'?s causeway|houses of the holy|freewheelin|physical graffiti|st\.?\s*mark|battersea|paramount ranch|bringing it all back home|gramercy|blonde on blonde|nashville skyline|wesley harding/i.test(
      lowerTitle
    )
  ) {
    return 'ALBUM_COVER';
  }

  if (
    /delacroix|deep ellum|dealey plaza|grassy knoll|montague|penny lane|strawberry field|blackburn|albert hall|winslow|standin.*corner|ashtabula|bishopsgate/i.test(
      lowerTitle
    ) &&
    !upperCat.includes('MURAL')
  ) {
    return 'LYRIC_MENTION';
  }

  if (upperCat.includes('LYRIC')) return 'LYRIC_MENTION';
  if (upperCat.includes('COVER') || upperCat.includes('ALBUM')) return 'ALBUM_COVER';
  if (upperCat.includes('TRIBUTE') || upperCat.includes('MURAL')) return 'TRIBUTE_MURAL';
  return 'HISTORIC_VENUE';
}

function resolvePinLore(pin: NormalizedPin): string {
  const text = `${pin.title} ${pin.songOrAlbum}`.toLowerCase();
  const artistLower = pin.artist.toLowerCase();

  if (/giant'?s causeway|houses of the holy/i.test(text)) {
    return 'The striking hexagonal basalt columns of the Giant’s Causeway in Northern Ireland provided the otherworldly landscape for Led Zeppelin’s 1973 album Houses of the Holy. Photographer Aubrey Powell shot black-and-white photos of two children climbing the ancient stones, later tinting them by hand to create the surreal, glowing collage.';
  }
  if (/kobra|mural|hennepin|minneapolis/i.test(text)) {
    return 'Towering 150 feet above Hennepin Avenue in downtown Minneapolis, Brazilian street artist Eduardo Kobra painted this kaleidoscope mural in 2015 to honor Minnesota’s native son. It depicts three distinct eras of Dylan’s life framed by a nod to his 1964 anthem "The Times They Are a-Changin’."';
  }
  if (/gaslight/i.test(text)) {
    return 'A subterranean poetry and folk basket-house at 116 MacDougal Street where Bob Dylan honed his early Greenwich Village persona between 1961 and 1962. On this cramped basement stage in September 1962, Dylan debuted "A Hard Rain’s a-Gonna Fall" weeks before the Cuban Missile Crisis.';
  }
  if (/bitter end/i.test(text)) {
    return 'Opened in 1961 at 147 Bleecker Street, New York’s oldest continuously operating rock and folk club served as a central hangout for Bob Dylan during the mid-1960s folk-rock boom and later hosted his legendary 1975 Rolling Thunder Revue rehearsals.';
  }
  if (/olympic studios/i.test(text)) {
    return 'Located in Barnes, southwest London, Olympic Studios was the sonic laboratory where Jimmy Page and engineer Eddie Kramer crafted textures for every Led Zeppelin studio album from their 1968 debut through Physical Graffiti, including the swirling stereo breakdown of "Whole Lotta Love."';
  }
  if (/ashtabula/i.test(text)) {
    return 'Immortalized on 1975’s Blood on the Tracks in "You’re Gonna Make Me Lonesome When You Go." Written as Dylan’s marriage was fracturing, the lyric nods to this Lake Erie port town in northeastern Ohio alongside Honolulu and San Francisco as places the narrator will look for his departing lover.';
  }
  if (/standin.*corner|winslow/i.test(text)) {
    return 'Born from Jackson Browne and Glenn Frey’s 1972 road anthem "Take It Easy." Browne’s car broke down in Winslow, Arizona on Route 66 during a trip to Sedona, inspiring the famous verse about idling on a street corner in Winslow watching a woman in a flatbed Ford slow down to take a look.';
  }
  if (/paramount ranch/i.test(text)) {
    return 'Nestled in the Santa Monica Mountains, this historic Western movie town served as the backdrop for photographer Henry Diltz’s 1973 Desperado album shoot, where the Eagles posed dressed as the Dalton Gang tied up after a frontier shootout.';
  }
  if (/beverly hills|hotel california/i.test(text)) {
    return 'Photographer David Alexander shot the sunset facade of the Beverly Hills Hotel at 9641 Sunset Boulevard from a cherry picker for the 1976 Hotel California sleeve—turning the pink Mission Revival landmark into an enduring symbol of Southern California excess and allure.';
  }
  if (/rooftop|savile row|apple corps/i.test(text)) {
    return 'On January 30, 1969, The Beatles climbed onto the roof of their Apple Corps headquarters at 3 Savile Row with Billy Preston for an unannounced 42-minute lunchtime set—their final public performance together, anchored by a raw rendition of "Don’t Let Me Down" before the Metropolitan Police pulled the plug.';
  }
  if (/royal albert|blackburn/i.test(text)) {
    if (artistLower.includes('zeppelin')) {
      return 'On January 9, 1970—Jimmy Page’s 26th birthday—Led Zeppelin delivered one of the most ferocious live performances of their career at London’s Royal Albert Hall, cementing their transition from blues-rock upstarts to stadium titans.';
    }
    return 'Referenced in the climactic final verse of 1967’s "A Day in the Life." John Lennon drew inspiration from a Daily Mail snippet about 4,000 potholes in Blackburn, Lancashire, joking that the holes were enough to fill the cavernous Victorian dome of the Royal Albert Hall.';
  }
  if (/grantchester/i.test(text)) {
    return 'A pastoral stretch of flood meadows along the River Cam just outside Cambridge where Pink Floyd’s Roger Waters and David Gilmour spent their youth. Waters wrote "Grantchester Meadows" for 1969’s Ummagumma as a nostalgic daydream of lazy summer afternoons by the water.';
  }
  if (/battersea/i.test(text)) {
    return 'Conceived by Roger Waters for Pink Floyd’s 1977 Animals cover, a 40-foot inflatable pig named Algie was tethered between the southern chimneys of this decommissioned London coal power station. On the second day of the shoot, Algie snapped its moorings and drifted into the Heathrow flight path.';
  }
  if (/abbey road/i.test(text)) {
    if (artistLower.includes('floyd')) {
      return 'Inside Studio Two and Studio Three at EMI’s Abbey Road Studios, Pink Floyd recorded their defining masterpieces from The Piper at the Gates of Dawn (while The Beatles recorded Sgt. Pepper down the hall) through 1973’s The Dark Side of the Moon and 1975’s Wish You Were Here.';
    }
    return 'On August 8, 1969, photographer Iain Macmillan balanced on a stepladder in the middle of Abbey Road outside EMI Studios for ten minutes while a policeman held back London traffic, capturing six frames of The Beatles striding across the zebra crossing.';
  }
  if (/britannia row/i.test(text)) {
    return 'Built by Pink Floyd in a converted three-story Methodist church at 35 Britannia Row in Islington after their Dark Side of the Moon tour. Here the band self-produced 1977’s Animals and recorded core sections of 1979’s The Wall.';
  }
  if (/bron-?y?r?-?aur/i.test(text)) {
    return 'An 18th-century stone cottage overlooking the Dyfi Valley in Snowdonia, Wales with no running water or electricity. In 1970, Robert Plant and Jimmy Page retreated here after a grueling US tour, writing acoustic pieces including the gentle instrumental "Bron-Yr-Aur" and the foot-stomping "Bron-Y-Aur Stomp."';
  }
  if (/headley grange/i.test(text)) {
    return 'A damp former poorhouse in Hampshire where Led Zeppelin rehearsed and recorded using the Rolling Stones Mobile Studio. By placing microphones up the three-story central stairwell while John Bonham played at the bottom, engineer Andy Johns captured the thunderous drum sound of "When the Levee Breaks."';
  }
  if (/physical graffiti|st\.?\s*mark/i.test(text)) {
    return 'Designer Peter Corriston photographed the twin 19th-century tenement buildings at 96 and 98 St. Mark’s Place in Manhattan’s East Village for Led Zeppelin’s 1975 Physical Graffiti die-cut sleeve, slicing out the top floor in the artwork so the building fit a square LP jacket.';
  }
  if (/delacroix/i.test(text)) {
    return 'Referenced in Bob Dylan’s 1975 storytelling masterpiece "Tangled Up in Blue." In the song’s third verse, the narrator drifts down to New Orleans and takes a job on a fishing boat just outside of Delacroix, a remote Isleño fishing community in St. Bernard Parish.';
  }
  if (/montague/i.test(text)) {
    return 'Situated in Brooklyn Heights, Montague Street provides the setting for the pivotal basement apartment scene in "Tangled Up in Blue," where the narrator recalls living in a Montague Street brownstone while music echoed from a nearby cafe.';
  }
  if (/deep ellum/i.test(text)) {
    return 'Founded in the late 19th century as a hub for Texas blues legends like Blind Lemon Jefferson and Lead Belly, this historic Dallas entertainment district is evoked in Bob Dylan’s 17-minute historical elegy "Murder Most Foul."';
  }
  if (/dealey plaza|grassy knoll/i.test(text)) {
    return 'The Dallas National Historic Landmark where President John F. Kennedy was assassinated on November 22, 1963—serving as the haunting geographical and spiritual anchor of Bob Dylan’s 2020 epic "Murder Most Foul."';
  }
  if (/columbia records|studio a/i.test(text)) {
    return 'Located at 799 Seventh Avenue in Manhattan, Columbia’s legendary Studio A is where Bob Dylan recorded his first six albums and where, in June 1965, session rookie Al Kooper improvised the swirling Hammond organ riff on "Like a Rolling Stone."';
  }
  if (/freewheelin|jones st/i.test(text)) {
    return 'In February 1963, CBS photographer Don Hunstein captured a 21-year-old Bob Dylan and his girlfriend Suze Rotolo huddling together in the slush down Jones Street just off West 4th Street in Greenwich Village—just steps from the couple’s fourth-floor walk-up apartment.';
  }
  if (/cafe wha/i.test(text)) {
    return 'After arriving in New York City in a snowstorm on January 24, 1961, a 19-year-old Bob Dylan walked straight into this MacDougal Street club and asked to play harmonica behind folk singer Fred Neil—an arrival he chronicled in "Talkin’ New York."';
  }
  if (/gerde|folk city/i.test(text)) {
    return 'Formerly located at 11 West 4th Street, Gerde’s Folk City gave Bob Dylan his first paid New York gig in April 1961 opening for John Lee Hooker, and hosted the first public performance of "Blowin’ in the Wind" in April 1962.';
  }
  if (/chelsea hotel|hotel chelsea/i.test(text)) {
    return 'The Victorian Gothic sanctuary at 222 West 23rd Street where Bob Dylan lived in Room 211 during the mid-1960s. In 1976’s "Sara," Dylan looks back nostalgically at staying up for days inside the Chelsea Hotel writing "Sad Eyed Lady of the Lowlands."';
  }
  if (/penny lane/i.test(text)) {
    return 'A bustling south Liverpool street and bus terminus where John Lennon and Paul McCartney met to catch buses into the city center as teenagers. McCartney’s 1967 single paints a vivid portrait of its barber shop, shelter in the middle of the roundabout, and fire station.';
  }
  if (/strawberry field/i.test(text)) {
    return 'A Salvation Army children’s home in Woolton, Liverpool just around the corner from John Lennon’s childhood home at Mendips. Young John used to hop the wall to play in its wooded grounds and hear the Salvation Army brass band, inspiring his 1967 psychedelic masterpiece.';
  }
  if (/cavern club/i.test(text)) {
    return 'A sweaty brick-vaulted cellar at 10 Mathew Street in Liverpool where The Beatles played 292 gigs between 1961 and 1963, catching the attention of manager Brian Epstein on November 9, 1961.';
  }
  if (/troubadour/i.test(text)) {
    return 'At 9081 Santa Monica Boulevard in West Hollywood, the Troubadour bar was the birthplace of 1970s California country-rock where Glenn Frey and Don Henley first met in 1970 while hanging out among Jackson Browne, Linda Ronstadt, and J.D. Souther.';
  }

  return pin.lyricOrContext;
}

function resolvePinTrack(pin: NormalizedPin): SongResolution {
  const text = `${pin.title} ${pin.songOrAlbum} ${pin.lyricOrContext}`.toLowerCase();
  const artistLower = pin.artist.toLowerCase();

  if (/giant'?s causeway|houses of the holy/i.test(text)) {
    return {
      artist: 'Led Zeppelin',
      song: 'Over the Hills and Far Away',
      album: 'Houses of the Holy',
      exactVerseTimestamp: '0:14 (Acoustic Intro Transition)',
      exactVerseSeconds: 14,
      previewSeekSeconds: 0,
      wikiSlug: "Giant's_Causeway",
    };
  }

  if (/kobra|mural|hennepin|minneapolis/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: "The Times They Are a-Changin'",
      album: "The Times They Are a-Changin'",
      exactVerseTimestamp: '0:10 (Opening Title Verse)',
      exactVerseSeconds: 10,
      previewSeekSeconds: 0,
      wikiSlug: 'Bob_Dylan_mural',
    };
  }

  if (/gaslight/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: "A Hard Rain's a-Gonna Fall",
      album: "The Freewheelin' Bob Dylan",
      exactVerseTimestamp: '0:12 (Opening Question Verse)',
      exactVerseSeconds: 12,
      previewSeekSeconds: 0,
      wikiSlug: 'MacDougal_Street',
    };
  }

  if (/bitter end/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Mr. Tambourine Man',
      album: 'Bringing It All Back Home',
      exactVerseTimestamp: '0:08 (Opening Chorus Refrain)',
      exactVerseSeconds: 8,
      previewSeekSeconds: 0,
      wikiSlug: 'The_Bitter_End',
    };
  }

  if (/olympic studios/i.test(text)) {
    return {
      artist: 'Led Zeppelin',
      song: 'Whole Lotta Love',
      album: 'Led Zeppelin II',
      exactVerseTimestamp: '0:02 (Opening Guitar Riff)',
      exactVerseSeconds: 2,
      previewSeekSeconds: 0,
      wikiSlug: 'Olympic_Studios',
    };
  }

  if (/ashtabula|lonesome when you go/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: "You're Gonna Make Me Lonesome When You Go",
      album: 'Blood on the Tracks',
      exactVerseTimestamp: '1:45 (Honolulu, San Francisco & Ashtabula Verse)',
      exactVerseSeconds: 105,
      previewSeekSeconds: 4,
    };
  }

  if (/standin.*corner|winslow/i.test(text)) {
    return {
      artist: 'Eagles',
      song: 'Take It Easy',
      album: 'Eagles',
      exactVerseTimestamp: '0:51 (Winslow, Arizona Verse)',
      exactVerseSeconds: 51,
      previewSeekSeconds: 8,
      wikiSlug: "Standin'_on_the_Corner_Park",
    };
  }

  if (/paramount ranch|desperado/i.test(text)) {
    return {
      artist: 'Eagles',
      song: 'Desperado',
      album: 'Desperado',
      exactVerseTimestamp: '1:08 ("Wintertime" Chorus)',
      exactVerseSeconds: 68,
      previewSeekSeconds: 6,
      wikiSlug: 'Paramount_Ranch',
    };
  }

  if (/beverly hills|camarillo|todos santos|hotel california/i.test(text)) {
    return {
      artist: 'Eagles',
      song: 'Hotel California',
      album: 'Hotel California',
      exactVerseTimestamp: '0:53 (Opening Vocal Verse)',
      exactVerseSeconds: 53,
      previewSeekSeconds: 4,
      wikiSlug: 'The_Beverly_Hills_Hotel',
    };
  }

  if (/rooftop|savile row|apple corps/i.test(text)) {
    return {
      artist: 'The Beatles',
      song: "Don't Let Me Down",
      exactVerseTimestamp: '0:02 (Opening Chorus Hook)',
      exactVerseSeconds: 2,
      previewSeekSeconds: 0,
      wikiSlug: '3_Savile_Row',
    };
  }

  if (/royal albert|blackburn|lancashire/i.test(text)) {
    if (artistLower.includes('zeppelin')) {
      return {
        artist: 'Led Zeppelin',
        song: 'Dazed and Confused',
        exactVerseTimestamp: '0:45 (Main Riff)',
        exactVerseSeconds: 45,
        previewSeekSeconds: 4,
        wikiSlug: 'Royal_Albert_Hall',
      };
    }
    return {
      artist: 'The Beatles',
      song: 'A Day in the Life',
      album: "Sgt. Pepper's Lonely Hearts Club Band",
      exactVerseTimestamp: '3:18 ("Albert Hall" Verse)',
      exactVerseSeconds: 198,
      previewSeekSeconds: 5,
      wikiSlug: 'Royal_Albert_Hall',
    };
  }

  if (/grantchester|river cam/i.test(text)) {
    return {
      artist: 'Pink Floyd',
      song: 'Grantchester Meadows',
      album: 'Ummagumma',
      exactVerseTimestamp: '1:05 (Opening Acoustic Verse)',
      exactVerseSeconds: 65,
      previewSeekSeconds: 12,
      wikiSlug: 'Grantchester_Meadows',
    };
  }

  if (/battersea/i.test(text)) {
    return {
      artist: 'Pink Floyd',
      song: 'Pigs (Three Different Ones)',
      album: 'Animals',
      exactVerseTimestamp: '1:02 (Opening Verse)',
      exactVerseSeconds: 62,
      previewSeekSeconds: 5,
      wikiSlug: 'Battersea_Power_Station',
    };
  }

  if (/abbey road/i.test(text)) {
    if (artistLower.includes('floyd')) {
      return {
        artist: 'Pink Floyd',
        song: 'Time',
        album: 'The Dark Side of the Moon',
        exactVerseTimestamp: '2:18 (Main Vocal Verse)',
        exactVerseSeconds: 138,
        previewSeekSeconds: 6,
        wikiSlug: 'Abbey_Road_Studios',
      };
    }
    return {
      artist: 'The Beatles',
      song: 'Come Together',
      album: 'Abbey Road',
      exactVerseTimestamp: '0:14 (Opening Groove)',
      exactVerseSeconds: 14,
      previewSeekSeconds: 0,
      wikiSlug: 'Abbey_Road',
    };
  }

  if (/britannia row/i.test(text)) {
    return {
      artist: 'Pink Floyd',
      song: 'Sheep',
      album: 'Animals',
      exactVerseTimestamp: '1:35 (Main Synth & Vocal Entry)',
      exactVerseSeconds: 95,
      previewSeekSeconds: 5,
      wikiSlug: 'Britannia_Row_Studios',
    };
  }

  if (/bron-?y?r?-?aur|machynlleth|snowdonia/i.test(text)) {
    return {
      artist: 'Led Zeppelin',
      song: 'Bron-Y-Aur Stomp',
      album: 'Led Zeppelin III',
      exactVerseTimestamp: '0:18 (Acoustic Stomp Hook)',
      exactVerseSeconds: 18,
      previewSeekSeconds: 3,
      wikiSlug: 'Bron-Yr-Aur',
    };
  }

  if (/headley grange/i.test(text)) {
    return {
      artist: 'Led Zeppelin',
      song: 'When the Levee Breaks',
      album: 'Led Zeppelin IV',
      exactVerseTimestamp: '0:00 (Bonham Stairwell Drum Intro)',
      exactVerseSeconds: 0,
      previewSeekSeconds: 0,
      wikiSlug: 'Headley_Grange',
    };
  }

  if (/physical graffiti|st\.?\s*mark/i.test(text)) {
    return {
      artist: 'Led Zeppelin',
      song: 'Kashmir',
      album: 'Physical Graffiti',
      exactVerseTimestamp: '0:00 (Main Orchestral Riff)',
      exactVerseSeconds: 0,
      previewSeekSeconds: 0,
      wikiSlug: 'Physical_Graffiti',
    };
  }

  if (/delacroix/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Tangled Up in Blue',
      album: 'Blood on the Tracks',
      exactVerseTimestamp: '1:58 (Delacroix Fishing Boat Verse)',
      exactVerseSeconds: 118,
      previewSeekSeconds: 4,
    };
  }

  if (/montague/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Tangled Up in Blue',
      album: 'Blood on the Tracks',
      exactVerseTimestamp: '2:56 (Montague Street Basement Verse)',
      exactVerseSeconds: 176,
      previewSeekSeconds: 4,
    };
  }

  if (/deep ellum|dealey plaza|grassy knoll/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Murder Most Foul',
      album: 'Rough and Rowdy Ways',
      exactVerseTimestamp: '0:42 (Dallas / Dealey Plaza Verse)',
      exactVerseSeconds: 42,
      previewSeekSeconds: 2,
      wikiSlug: 'Dealey_Plaza',
    };
  }

  if (/columbia records|studio a/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Like a Rolling Stone',
      album: 'Highway 61 Revisited',
      exactVerseTimestamp: '1:05 ("How Does It Feel" Chorus)',
      exactVerseSeconds: 65,
      previewSeekSeconds: 5,
      wikiSlug: 'Columbia_Records',
    };
  }

  if (/freewheelin|jones st/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: "Blowin' in the Wind",
      album: "The Freewheelin' Bob Dylan",
      exactVerseTimestamp: '0:08 (Opening Verse)',
      exactVerseSeconds: 8,
      previewSeekSeconds: 0,
      wikiSlug: "The_Freewheelin'_Bob_Dylan",
    };
  }
  if (/bringing it all back home|byrdcliffe/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Subterranean Homesick Blues',
      album: 'Bringing It All Back Home',
      exactVerseTimestamp: '0:06 (Opening Rapid-Fire Verse)',
      exactVerseSeconds: 6,
      previewSeekSeconds: 0,
      wikiSlug: 'Bringing_It_All_Back_Home',
    };
  }
  if (/highway 61|gramercy/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Highway 61 Revisited',
      album: 'Highway 61 Revisited',
      exactVerseTimestamp: '0:12 (Siren Whistle & Opening Verse)',
      exactVerseSeconds: 12,
      previewSeekSeconds: 2,
      wikiSlug: 'Highway_61_Revisited',
    };
  }
  if (/blonde on blonde|14th st/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Visions of Johanna',
      album: 'Blonde on Blonde',
      exactVerseTimestamp: '0:18 (Opening Verse)',
      exactVerseSeconds: 18,
      previewSeekSeconds: 2,
      wikiSlug: 'Blonde_on_Blonde',
    };
  }
  if (/john wesley harding/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'All Along the Watchtower',
      album: 'John Wesley Harding',
      exactVerseTimestamp: '0:15 (Opening Verse)',
      exactVerseSeconds: 15,
      previewSeekSeconds: 0,
      wikiSlug: 'John_Wesley_Harding',
    };
  }
  if (/nashville skyline|music square/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Lay Lady Lay',
      album: 'Nashville Skyline',
      exactVerseTimestamp: '0:16 (Opening Refrain)',
      exactVerseSeconds: 16,
      previewSeekSeconds: 0,
      wikiSlug: 'Nashville_Skyline',
    };
  }

  if (/cafe wha/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: "Talkin' New York",
      album: 'Bob Dylan',
      exactVerseTimestamp: '0:15 (Greenwich Village Arrival Verse)',
      exactVerseSeconds: 15,
      previewSeekSeconds: 0,
      wikiSlug: 'MacDougal_Street',
    };
  }
  if (/chelsea hotel|hotel chelsea/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: 'Sara',
      album: 'Desire',
      exactVerseTimestamp: '3:35 (Chelsea Hotel Verse)',
      exactVerseSeconds: 215,
      previewSeekSeconds: 4,
      wikiSlug: 'Hotel_Chelsea',
    };
  }
  if (/gerde|folk city/i.test(text)) {
    return {
      artist: 'Bob Dylan',
      song: "Blowin' in the Wind",
      album: "The Freewheelin' Bob Dylan",
      exactVerseTimestamp: '0:08 (Debuted Live at Gerde’s in 1962)',
      exactVerseSeconds: 8,
      previewSeekSeconds: 0,
      wikiSlug: 'MacDougal_Street',
    };
  }
  if (/penny lane/i.test(text)) {
    return {
      artist: 'The Beatles',
      song: 'Penny Lane',
      exactVerseTimestamp: '0:04 (Penny Lane Verse)',
      exactVerseSeconds: 4,
      previewSeekSeconds: 0,
      wikiSlug: 'Penny_Lane',
    };
  }
  if (/strawberry field/i.test(text)) {
    return {
      artist: 'The Beatles',
      song: 'Strawberry Fields Forever',
      exactVerseTimestamp: '0:12 (Chorus Refrain)',
      exactVerseSeconds: 12,
      previewSeekSeconds: 0,
      wikiSlug: 'Strawberry_Field',
    };
  }
  if (/cavern club/i.test(text)) {
    return {
      artist: 'The Beatles',
      song: 'I Saw Her Standing There',
      exactVerseTimestamp: '0:03 ("1-2-3-4!" Intro)',
      exactVerseSeconds: 3,
      previewSeekSeconds: 0,
      wikiSlug: 'The_Cavern_Club',
    };
  }
  if (/bishopsgate|mr\.?\s*kite/i.test(text)) {
    return {
      artist: 'The Beatles',
      song: 'Being for the Benefit of Mr. Kite!',
      exactVerseTimestamp: '0:22 (Bishopsgate Verse)',
      exactVerseSeconds: 22,
      previewSeekSeconds: 0,
    };
  }
  if (/troubadour/i.test(text)) {
    return {
      artist: 'Eagles',
      song: 'Peaceful Easy Feeling',
      exactVerseTimestamp: '0:18 (Opening Verse)',
      exactVerseSeconds: 18,
      previewSeekSeconds: 3,
      wikiSlug: 'Troubadour_(West_Hollywood,_California)',
    };
  }
  if (/ufo club|roundhouse/i.test(text)) {
    return {
      artist: 'Pink Floyd',
      song: 'Astronomy Domine',
      exactVerseTimestamp: '0:28 (Opening Vocal)',
      exactVerseSeconds: 28,
      previewSeekSeconds: 4,
      wikiSlug: 'Roundhouse_(venue)',
    };
  }
  if (/warner bros|wish you were here/i.test(text)) {
    return {
      artist: 'Pink Floyd',
      song: 'Wish You Were Here',
      album: 'Wish You Were Here',
      exactVerseTimestamp: '1:18 (Opening Vocal Verse)',
      exactVerseSeconds: 78,
      previewSeekSeconds: 5,
      wikiSlug: 'Wish_You_Were_Here_(Pink_Floyd_album)',
    };
  }

  if (artistLower.includes('dylan')) {
    return {
      artist: 'Bob Dylan',
      song: 'Like a Rolling Stone',
      exactVerseTimestamp: '1:05 (Chorus Hook)',
      exactVerseSeconds: 65,
      previewSeekSeconds: 4,
      wikiSlug: 'Bob_Dylan',
    };
  }
  if (artistLower.includes('zeppelin')) {
    return {
      artist: 'Led Zeppelin',
      song: 'Whole Lotta Love',
      exactVerseTimestamp: '0:02 (Main Riff)',
      exactVerseSeconds: 2,
      previewSeekSeconds: 0,
      wikiSlug: 'Led_Zeppelin',
    };
  }
  if (artistLower.includes('beatles')) {
    return {
      artist: 'The Beatles',
      song: 'In My Life',
      exactVerseTimestamp: '0:10 (Opening Verse)',
      exactVerseSeconds: 10,
      previewSeekSeconds: 0,
      wikiSlug: 'The_Beatles',
    };
  }
  if (artistLower.includes('eagles')) {
    return {
      artist: 'Eagles',
      song: 'Take It Easy',
      exactVerseTimestamp: '0:13 (Opening Verse)',
      exactVerseSeconds: 13,
      previewSeekSeconds: 4,
      wikiSlug: 'Eagles_(band)',
    };
  }
  return {
    artist: 'Pink Floyd',
    song: 'Wish You Were Here',
    exactVerseTimestamp: '1:18 (Opening Verse)',
    exactVerseSeconds: 78,
    previewSeekSeconds: 5,
    wikiSlug: 'Pink_Floyd',
  };
}

function getCategoryColor(category: string): string {
  const upper = (category || '').toUpperCase();
  if (upper.includes('LYRIC')) return '#3b82f6';
  if (upper.includes('COVER') || upper.includes('ALBUM')) return '#ec4899';
  if (upper.includes('VENUE')) return '#10b981';
  if (upper.includes('TRIBUTE') || upper.includes('MURAL')) return '#a855f7';
  return '#f59e0b';
}

// Step 4.2: Custom Inline SVG Icon Renderer for the 4 Pin Categories
function renderCategorySvgIcon(category: string, color: string) {
  const upper = (category || '').toUpperCase();

  // 1. ALBUM_COVER: Stylized Vinyl Record / LP Disc
  if (upper.includes('COVER') || upper.includes('ALBUM')) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="9.5" fill="#09090b" stroke={color} strokeWidth="2" />
        <path
          d="M7.5 12A4.5 4.5 0 0 1 12 7.5"
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M16.5 12A4.5 4.5 0 0 1 12 16.5"
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.75"
        />
        <circle cx="12" cy="12" r="3.2" fill={color} />
        <circle cx="12" cy="12" r="1.1" fill="#09090b" />
      </svg>
    );
  }

  // 2. HISTORIC_VENUE: Minimalist Vintage Stage Microphone
  if (upper.includes('VENUE')) {
    return (
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="9"
          y="3"
          width="6"
          height="10"
          rx="3"
          fill={color}
          fillOpacity="0.25"
          stroke={color}
          strokeWidth="2"
        />
        <line x1="9" y1="7.5" x2="15" y2="7.5" stroke={color} strokeWidth="1.4" />
        <path
          d="M6 10.5V11C6 14.3137 8.68629 17 12 17C15.3137 17 18 14.3137 18 11V10.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1="8.5" y1="21" x2="15.5" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 3. TRIBUTE_MURAL: Stylized Artist Paintbrush
  if (upper.includes('TRIBUTE') || upper.includes('MURAL')) {
    return (
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18.37 3.63C19.15 4.41 19.15 5.68 18.37 6.46L11.5 13.33L8.67 10.5L15.54 3.63C16.32 2.85 17.59 2.85 18.37 3.63Z"
          fill={color}
          fillOpacity="0.3"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M8.67 10.5L11.5 13.33C11.5 15.8 9.8 18.5 6.5 19.5C5.2 19.89 4.2 19.6 3.5 19C4.1 17.8 4.4 16.5 4.7 15.2C5.2 12.8 6.8 11.2 8.67 10.5Z"
          fill={color}
          stroke={color}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 4. LYRIC_MENTION (Default): Beamed Double Musical Note
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 17.5V6.5L19 4.5V15.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 9.5L19 7.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="6.5" cy="17.5" r="2.7" fill={color} />
      <circle cx="16.5" cy="15.5" r="2.7" fill={color} />
    </svg>
  );
}

function getSurvivalBadge(siteStatus: string, businessStatus: string) {
  const combined = `${siteStatus} ${businessStatus}`.toUpperCase();
  if (combined.includes('OPERATIONAL') || combined.includes('INTACT_PUBLIC')) {
    return {
      label: 'Intact & Open',
      subtext: siteStatus || businessStatus || 'OPERATIONAL',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: '#10b981',
      text: '#34d399',
      dot: '#10b981',
    };
  }
  if (combined.includes('LANDMARK') || combined.includes('FACADE') || combined.includes('PRIVATE')) {
    return {
      label: 'Facade Only / Landmark',
      subtext: siteStatus || businessStatus || 'LANDMARK_OR_PUBLIC',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: '#f59e0b',
      text: '#fbbf24',
      dot: '#f59e0b',
    };
  }
  return {
    label: 'Ghost Site / Plaque Only',
    subtext: siteStatus || businessStatus || 'HISTORIC_SITE',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: '#ef4444',
    text: '#f87171',
    dot: '#ef4444',
  };
}

export default function VerseMapPage() {
  const mapRef = useRef(null as MapRef | null);
  const audioRef = useRef(null as HTMLAudioElement | null);

  const [pins, setPins] = useState([] as NormalizedPin[]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null as string | null);

  const [selectedArtist, setSelectedArtist] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedEra, setSelectedEra] = useState('ALL');
  const [placeSearch, setPlaceSearch] = useState('');
  const [mapCursor, setMapCursor] = useState('grab');

  // Step 4.2: Viewport & Hover State for Custom HTML/SVG Unclustered Markers
  const [mapZoom, setMapZoom] = useState(INITIAL_MAP_VIEW.zoom);
  const [mapBounds, setMapBounds] = useState(DEFAULT_BOUNDS as ViewportBounds);
  const [hoveredPinId, setHoveredPinId] = useState(null as string | number | null);

  const [selectedPin, setSelectedPin] = useState(null as NormalizedPin | null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null as string | null);
  const [audioTrackName, setAudioTrackName] = useState('');
  const [audioArtwork, setAudioArtwork] = useState(null as string | null);
  const [pinVisualUrl, setPinVisualUrl] = useState(null as string | null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  const [windowWidth, setWindowWidth] = useState(1200);

  const [tourStops, setTourStops] = useState([] as NormalizedPin[]);
  const [isTourTrayOpen, setIsTourTrayOpen] = useState(false);
  const [isRouteOptimized, setIsRouteOptimized] = useState(false);

  useEffect(function () {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return function () {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isMobile = windowWidth < 768;

  const syncViewportState = function () {
    if (!mapRef.current) return;
    const currentZoom = mapRef.current.getZoom();
    if (typeof currentZoom === 'number' && !Number.isNaN(currentZoom)) {
      setMapZoom(currentZoom);
    }
    const b = mapRef.current.getBounds();
    if (b) {
      setMapBounds({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      });
    }
  };

  useEffect(function () {
    async function fetchPins() {
      setLoading(true);
      const { data, error } = await supabase.from('pins').select('*');

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const seenTitles = new Set();

      const dbPins: NormalizedPin[] = (data || [])
        .map(function (row: any, idx: number) {
          const lat = Number(row.lat ?? row.latitude);
          const lng = Number(row.lng ?? row.longitude);
          const rawTitle = String(row.title ?? row.location_name ?? 'Untitled Location').trim();
          const rawArtist = String(row.artist ?? row.artist_name ?? 'Classic Rock Artist').trim();
          const rawCategory = String(row.pin_type ?? row.category ?? 'HISTORIC_VENUE');

          const fixedCategory = normalizeAndFixCategory(rawTitle, rawCategory, rawArtist);

          const basePin: NormalizedPin = {
            id: row.id ?? idx,
            title: rawTitle,
            artist: rawArtist,
            category: fixedCategory,
            lat,
            lng,
            placeId: row.google_place_id ?? row.place_id ?? '',
            siteStatus: row.site_status ?? '',
            businessStatus: row.business_status ?? row.live_status ?? '',
            lyricOrContext:
              row.lyric_quote ??
              row.historical_context ??
              row.context ??
              row.description ??
              row.lore ??
              'Verified historic music landmark and cultural touchstone.',
            songOrAlbum:
              row.song_title ??
              row.album_title ??
              row.source_work ??
              row.song ??
              row.album ??
              '',
            releaseYear: row.release_year ? Number(row.release_year) : null,
            sceneTags: Array.isArray(row.scene_tags) ? row.scene_tags : [],
            rawQuery: row.search_query ?? row.query ?? row.address ?? '',
          };

          const resolved = resolvePinTrack(basePin);
          const enrichedLore = resolvePinLore(basePin);

          return {
            ...basePin,
            artist: resolved.artist || basePin.artist,
            songOrAlbum: resolved.song,
            lyricOrContext: enrichedLore,
            exactVerseTimestamp: resolved.exactVerseTimestamp,
            exactVerseSeconds: resolved.exactVerseSeconds,
            previewSeekSeconds: resolved.previewSeekSeconds,
            wikiSlug: resolved.wikiSlug,
          };
        })
        .filter(function (p: NormalizedPin) {
          if (Number.isNaN(p.lat) || Number.isNaN(p.lng) || p.lat === 0 || p.lng === 0) {
            return false;
          }
          if (/bourbon street/i.test(p.title)) {
            return false;
          }
          const isJonesDuplicate = /jones st/i.test(p.title) && !/freewheelin/i.test(p.title);
          if (isJonesDuplicate) {
            return false;
          }
          const key = `${p.artist.toLowerCase()}::${p.title.toLowerCase()}`;
          if (seenTitles.has(key)) return false;
          seenTitles.add(key);
          return true;
        });

      const mergedPins = [...dbPins];
      for (const sup of SUPPLEMENTAL_VERIFIED_PINS) {
        const alreadyExists = mergedPins.some(function (existing) {
          return (
            Math.abs(existing.lat - sup.lat) < 0.002 &&
            Math.abs(existing.lng - sup.lng) < 0.002
          );
        });
        if (!alreadyExists) {
          const resolved = resolvePinTrack(sup);
          mergedPins.push({
            ...sup,
            songOrAlbum: resolved.song,
            lyricOrContext: resolvePinLore(sup),
            exactVerseTimestamp: resolved.exactVerseTimestamp,
            exactVerseSeconds: resolved.exactVerseSeconds,
            previewSeekSeconds: resolved.previewSeekSeconds,
            wikiSlug: resolved.wikiSlug ?? sup.wikiSlug,
          });
        }
      }

      setPins(mergedPins);
      setLoading(false);
    }

    fetchPins();
  }, []);

  useEffect(
    function () {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setIsPlayingPreview(false);
      setAudioProgress(0);
      setAudioCurrentTime(0);
      setPinVisualUrl(null);

      if (!selectedPin) {
        setAudioUrl(null);
        setAudioTrackName('');
        setAudioArtwork(null);
        setAudioLoading(false);
        return;
      }

      let isCancelled = false;

      async function fetchTrackAndPhoto(pin: NormalizedPin) {
        setAudioLoading(true);
        setAudioUrl(null);
        setAudioArtwork(null);

        const target = resolvePinTrack(pin);
        setAudioTrackName(`${target.song} • ${target.artist}`);

        if (/kobra|hennepin|minneapolis/i.test(pin.title)) {
          setPinVisualUrl(
            'https://upload.wikimedia.org/wikipedia/commons/4/4b/Bob_Dylan_Mural_by_Eduardo_Kobra.jpg'
          );
        } else if (pin.category === 'HISTORIC_VENUE' || pin.category === 'TRIBUTE_MURAL') {
          const wikiPage =
            target.wikiSlug ||
            pin.wikiSlug ||
            pin.title.split('—')[0].split('(')[0].trim().replace(/\s+/g, '_');

          try {
            const wikiRes = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiPage)}`
            );
            if (wikiRes.ok) {
              const wikiJson = await wikiRes.json();
              const imgUrl =
                (wikiJson.originalimage && wikiJson.originalimage.source) ||
                (wikiJson.thumbnail && wikiJson.thumbnail.source) ||
                null;
              if (!isCancelled && imgUrl) {
                setPinVisualUrl(imgUrl);
              }
            }
          } catch (e) {
            // Wikipedia fallback
          }
        }

        const cleanArtistToken = target.artist
          .toLowerCase()
          .replace(/^the\s+/i, '')
          .trim();

        const coreSongToken = target.song
          .toLowerCase()
          .replace(/\([^)]*\)/g, '')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const queries = [
          `${target.artist} ${target.song}`,
          `${target.artist} ${coreSongToken}`,
          target.artist,
        ];

        for (const query of queries) {
          try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
              query
            )}&media=music&entity=song&limit=25`;
            const res = await fetch(url);
            if (!res.ok) continue;

            const json = await res.json();
            const results: any[] = (json.results || []).filter(function (r: any) {
              return Boolean(r.previewUrl);
            });

            const scored = results
              .map(function (item: any) {
                const itemArtist = String(item.artistName || '').toLowerCase();
                const itemTrackRaw = String(item.trackName || '').toLowerCase();
                const itemTrackCore = itemTrackRaw
                  .replace(/\([^)]*\)/g, '')
                  .replace(/[^a-z0-9\s]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                const itemCollection = String(item.collectionName || '').toLowerCase();

                let score = 0;

                if (itemArtist.includes(cleanArtistToken)) {
                  score += 120;
                } else {
                  score -= 300;
                }

                if (
                  /karaoke|tribute|lullaby|8-bit|made famous|in the style/i.test(
                    `${itemArtist} ${itemTrackRaw} ${itemCollection}`
                  )
                ) {
                  score -= 400;
                }

                if (itemTrackCore === coreSongToken) {
                  score += 100;
                } else if (
                  itemTrackCore.includes(coreSongToken) ||
                  coreSongToken.includes(itemTrackCore)
                ) {
                  score += 70;
                }

                if (target.album) {
                  const targetAlbumClean = target.album.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const itemAlbumClean = itemCollection.replace(/[^a-z0-9]/g, '');
                  if (itemAlbumClean.includes(targetAlbumClean)) {
                    score += 300;
                  } else {
                    score -= 100;
                  }
                }

                return { item, score };
              })
              .filter(function (entry) {
                return 100 <= entry.score;
              })
              .sort(function (a, b) {
                return b.score - a.score;
              });

            if (!isCancelled && 0 < scored.length) {
              const best = scored[0].item;
              const thumb = best.artworkUrl100 || best.artworkUrl60 || null;
              const hiResCover = thumb ? thumb.replace('100x100bb', '600x600bb') : null;

              setAudioUrl(best.previewUrl);
              setAudioTrackName(`${best.trackName} • ${best.artistName}`);
              setAudioArtwork(thumb);

              if (pin.category === 'ALBUM_COVER') {
                setPinVisualUrl(hiResCover);
              } else if (pin.category !== 'LYRIC_MENTION') {
                setPinVisualUrl(function (prev) {
                  return prev || hiResCover;
                });
              }

              setAudioLoading(false);
              return;
            }
          } catch (e) {
            // Next query
          }
        }

        if (!isCancelled) {
          setAudioLoading(false);
        }
      }

      fetchTrackAndPhoto(selectedPin);

      return function () {
        isCancelled = true;
      };
    },
    [selectedPin]
  );

  const handleToggleAudio = function () {
    if (!audioUrl || audioLoading) return;

    const seekOffset = selectedPin?.previewSeekSeconds ?? 0;

    if (!audioRef.current) {
      const audio = new window.Audio(audioUrl);
      audioRef.current = audio;

      audio.onloadedmetadata = function () {
        if (0 < seekOffset && seekOffset < (audio.duration || 30) - 5) {
          audio.currentTime = seekOffset;
        }
      };

      audio.ontimeupdate = function () {
        const duration = audio.duration || 30;
        setAudioCurrentTime(Math.floor(audio.currentTime));
        setAudioProgress(Math.min(100, (audio.currentTime / duration) * 100));
      };

      audio.onended = function () {
        setIsPlayingPreview(false);
        setAudioProgress(0);
        setAudioCurrentTime(0);
      };

      audio.onerror = function () {
        setIsPlayingPreview(false);
      };
    }

    if (isPlayingPreview) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioRef.current
        .play()
        .then(function () {
          setIsPlayingPreview(true);
        })
        .catch(function () {
          setIsPlayingPreview(false);
        });
    }
  };

  const artistOptions: string[] = useMemo(
    function () {
      const set = new Set();
      pins.forEach(function (p) {
        if (p.artist) set.add(p.artist);
      });
      return ['ALL', ...(Array.from(set) as string[]).sort()];
    },
    [pins]
  );

  const filteredPins: NormalizedPin[] = useMemo(
    function () {
      const normalizedPlaceQuery = placeSearch.trim().toLowerCase();

      return pins.filter(function (pin) {
        if (selectedArtist !== 'ALL' && pin.artist !== selectedArtist) return false;
        if (selectedCategory !== 'ALL' && pin.category !== selectedCategory) return false;

        if (normalizedPlaceQuery !== '') {
          const searchablePlaceText =
            `${pin.title} ${pin.rawQuery} ${pin.lyricOrContext} ${pin.songOrAlbum} ${pin.sceneTags.join(' ')}`.toLowerCase();
          if (!searchablePlaceText.includes(normalizedPlaceQuery)) {
            return false;
          }
        }

        if (selectedEra === 'GREENWICH_VILLAGE') {
          const isNYC = 40.5 < pin.lat && pin.lat < 42.2 && -74.5 < pin.lng && pin.lng < -73.7;
          const isDylan = pin.artist.toLowerCase().includes('dylan');
          const hasTag = pin.sceneTags.some(function (t) {
            return t.toLowerCase().includes('greenwich');
          });
          return isNYC || isDylan || hasTag;
        }

        if (selectedEra === 'LAUREL_CANYON') {
          const isSoCal = 33.5 < pin.lat && pin.lat < 35.5 && -119.0 < pin.lng && pin.lng < -110.0;
          const isEagles = pin.artist.toLowerCase().includes('eagles');
          const hasTag = pin.sceneTags.some(function (t) {
            return t.toLowerCase().includes('laurel');
          });
          return isSoCal || isEagles || hasTag;
        }

        if (selectedEra === 'SWINGING_LONDON') {
          const isUK = 51.0 < pin.lat && pin.lat < 53.6 && -4.5 < pin.lng && pin.lng < 0.5;
          const hasTag = pin.sceneTags.some(function (t) {
            return t.toLowerCase().includes('london');
          });
          return isUK || hasTag;
        }

        return true;
      });
    },
    [pins, selectedArtist, selectedCategory, selectedEra, placeSearch]
  );

  const spiderfiedPins: NormalizedPin[] = useMemo(
    function () {
      const threshold = 0.00055;
      const offsetRadius = 0.00026;

      return filteredPins.map(function (pin, idx) {
        const clusterMembers = filteredPins.filter(function (other) {
          return (
            Math.abs(other.lat - pin.lat) < threshold &&
            Math.abs(other.lng - pin.lng) < threshold
          );
        });

        if (clusterMembers.length <= 1) {
          return {
            ...pin,
            displayLat: pin.lat,
            displayLng: pin.lng,
          };
        }

        const positionInCluster = clusterMembers.findIndex(function (member) {
          return member.id === pin.id;
        });
        const safeIndex = positionInCluster === -1 ? idx : positionInCluster;
        const angle = (safeIndex * 2 * Math.PI) / clusterMembers.length;

        return {
          ...pin,
          displayLat: pin.lat + Math.sin(angle) * offsetRadius,
          displayLng: pin.lng + Math.cos(angle) * offsetRadius,
        };
      });
    },
    [filteredPins]
  );

  const pinsGeoJson: any = useMemo(
    function () {
      const features = spiderfiedPins.map(function (pin) {
        const isCurrentSelected = selectedPin
          ? String(selectedPin.id) === String(pin.id)
          : false;

        return {
          type: 'Feature',
          properties: {
            pinId: String(pin.id),
            title: pin.title,
            artist: pin.artist,
            category: pin.category,
            color: getCategoryColor(pin.category),
            isSelected: isCurrentSelected,
          },
          geometry: {
            type: 'Point',
            coordinates: [pin.displayLng ?? pin.lng, pin.displayLat ?? pin.lat],
          },
        };
      });

      return {
        type: 'FeatureCollection',
        features: features,
      };
    },
    [spiderfiedPins, selectedPin]
  );

  // Step 4.2: Compute visible unclustered pins + active Tour Bus stops for custom HTML/SVG rendering
  const visibleHtmlPins: NormalizedPin[] = useMemo(
    function () {
      const projectedList = spiderfiedPins.map(function (pin) {
        const lat = pin.displayLat ?? pin.lat;
        const lng = pin.displayLng ?? pin.lng;
        const px = projectToWorldPixels(lat, lng, mapZoom);
        return {
          pin: pin,
          lat: lat,
          lng: lng,
          x: px.x,
          y: px.y,
        };
      });

      const result: NormalizedPin[] = [];
      const addedIds = new Set<string>();

      for (let i = 0; i < projectedList.length; i = i + 1) {
        const item = projectedList[i];
        const pinIdStr = String(item.pin.id);

        const isTourStop = tourStops.some(function (stop) {
          return String(stop.id) === pinIdStr;
        });
        const isCurrentSelected = selectedPin
          ? String(selectedPin.id) === pinIdStr
          : false;

        if (isTourStop || isCurrentSelected) {
          result.push(item.pin);
          addedIds.add(pinIdStr);
          continue;
        }

        if (!isPinWithinBounds(item.lat, item.lng, mapBounds)) {
          continue;
        }

        if (CLUSTER_MAX_ZOOM < mapZoom) {
          result.push(item.pin);
          addedIds.add(pinIdStr);
          continue;
        }

        let hasClusterNeighbor = false;
        for (let j = 0; j < projectedList.length; j = j + 1) {
          if (i === j) continue;
          const other = projectedList[j];
          const dx = item.x - other.x;
          const dy = item.y - other.y;
          const distPx = Math.sqrt(dx * dx + dy * dy);
          if (distPx <= CLUSTER_RADIUS_PX) {
            hasClusterNeighbor = true;
            break;
          }
        }

        if (!hasClusterNeighbor) {
          result.push(item.pin);
          addedIds.add(pinIdStr);
        }
      }

      // Ensure any Tour Bus stop filtered out by category/artist still renders its numbered stop marker
      for (let k = 0; k < tourStops.length; k = k + 1) {
        const stop = tourStops[k];
        const stopIdStr = String(stop.id);
        if (!addedIds.has(stopIdStr)) {
          result.push(stop);
          addedIds.add(stopIdStr);
        }
      }

      return result;
    },
    [spiderfiedPins, mapZoom, mapBounds, tourStops, selectedPin]
  );

  const handleFlyToPlaceResults = function () {
    if (!mapRef.current || filteredPins.length === 0) return;

    if (filteredPins.length === 1) {
      const single = filteredPins[0];
      setSelectedPin(single);
      mapRef.current.flyTo({
        center: [single.lng, single.lat],
        zoom: 14,
        duration: 1200,
        essential: true,
      });
      return;
    }

    let minLat = filteredPins[0].lat;
    let maxLat = filteredPins[0].lat;
    let minLng = filteredPins[0].lng;
    let maxLng = filteredPins[0].lng;

    for (let i = 1; i < filteredPins.length; i = i + 1) {
      const p = filteredPins[i];
      if (p.lat < minLat) minLat = p.lat;
      if (maxLat < p.lat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (maxLng < p.lng) maxLng = p.lng;
    }

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const maxSpan = Math.max(maxLat - minLat, maxLng - minLng);

    let targetZoom = 12.5;
    if (25 < maxSpan) targetZoom = 2.6;
    else if (6 < maxSpan) targetZoom = 5.2;
    else if (1.2 < maxSpan) targetZoom = 8.5;
    else if (0.2 < maxSpan) targetZoom = 11.2;

    mapRef.current.flyTo({
      center: [centerLng, centerLat],
      zoom: targetZoom,
      duration: 1300,
      essential: true,
    });
  };

  const isPinInTour = function (pinId: string | number) {
    return tourStops.some(function (stop) {
      return String(stop.id) === String(pinId);
    });
  };

  const getTourStopNumber = function (pinId: string | number) {
    const index = tourStops.findIndex(function (stop) {
      return String(stop.id) === String(pinId);
    });
    return index === -1 ? null : index + 1;
  };

  const handleToggleTourStop = function (pin: NormalizedPin) {
    const exists = isPinInTour(pin.id);
    setIsRouteOptimized(false);
    if (exists) {
      setTourStops(
        tourStops.filter(function (stop) {
          return String(stop.id) !== String(pin.id);
        })
      );
    } else {
      setTourStops([...tourStops, pin]);
      setIsTourTrayOpen(true);
    }
  };

  const handleRemoveTourStop = function (pinId: string | number) {
    setIsRouteOptimized(false);
    setTourStops(
      tourStops.filter(function (stop) {
        return String(stop.id) !== String(pinId);
      })
    );
  };

  const handleClearTourStops = function () {
    setTourStops([]);
    setIsRouteOptimized(false);
    setIsTourTrayOpen(false);
  };

  const handleOptimizeRoute = function () {
    if (tourStops.length < 2) return;
    const optimized = optimizeStopsNearestNeighbor(tourStops);
    setTourStops(optimized);
    setIsRouteOptimized(true);

    if (mapRef.current && 0 < optimized.length) {
      let minLat = optimized[0].lat;
      let maxLat = optimized[0].lat;
      let minLng = optimized[0].lng;
      let maxLng = optimized[0].lng;

      for (let i = 1; i < optimized.length; i = i + 1) {
        const s = optimized[i];
        if (s.lat < minLat) minLat = s.lat;
        if (maxLat < s.lat) maxLat = s.lat;
        if (s.lng < minLng) minLng = s.lng;
        if (maxLng < s.lng) maxLng = s.lng;
      }

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const maxSpan = Math.max(maxLat - minLat, maxLng - minLng);

      let targetZoom = 13.5;
      if (20 < maxSpan) targetZoom = 2.6;
      else if (5 < maxSpan) targetZoom = 5.0;
      else if (1 < maxSpan) targetZoom = 8.5;
      else if (0.15 < maxSpan) targetZoom = 11.2;

      mapRef.current.flyTo({
        center: [centerLng, centerLat],
        zoom: targetZoom,
        duration: 1400,
        essential: true,
      });
    }
  };

  const routeGeoJson: any = useMemo(
    function () {
      if (!isRouteOptimized || tourStops.length < 2) {
        return null;
      }

      const coordinates = tourStops.map(function (stop) {
        const spiderMatch = spiderfiedPins.find(function (sp) {
          return String(sp.id) === String(stop.id);
        });
        const lng = spiderMatch ? (spiderMatch.displayLng ?? stop.lng) : stop.lng;
        const lat = spiderMatch ? (spiderMatch.displayLat ?? stop.lat) : stop.lat;
        return [lng, lat];
      });

      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates,
            },
          },
        ],
      };
    },
    [isRouteOptimized, tourStops, spiderfiedPins]
  );

  const totalRouteKm: number = useMemo(
    function () {
      return calculateTotalRouteDistanceKm(tourStops);
    },
    [tourStops]
  );

  const buildGoogleMapsDirectionsUrl = function () {
    if (tourStops.length < 2) return 'https://www.google.com/maps';

    const firstStop = tourStops[0];
    const lastStop = tourStops[tourStops.length - 1];
    const origin = `${firstStop.lat},${firstStop.lng}`;
    const destination = `${lastStop.lat},${lastStop.lng}`;

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(destination)}`;

    if (2 < tourStops.length) {
      const middleStops = tourStops.slice(1, tourStops.length - 1);
      const waypointsPipe = middleStops
        .map(function (stop) {
          return `${stop.lat},${stop.lng}`;
        })
        .join('|');
      url = `${url}&waypoints=${encodeURIComponent(waypointsPipe)}`;
    }

    return url;
  };

  const handleExportDirections = function () {
    if (tourStops.length < 2) return;
    const directionsUrl = buildGoogleMapsDirectionsUrl();
    window.open(directionsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEraChange = function (eraId: string) {
    setSelectedEra(eraId);
    setSelectedPin(null);
    const preset = ERA_PRESETS.find(function (e) {
      return e.id === eraId;
    });
    if (preset && mapRef.current) {
      mapRef.current.flyTo({
        center: [preset.center.lng, preset.center.lat],
        zoom: preset.center.zoom,
        duration: 1800,
        essential: true,
      });
    }
  };

  // Step 4.2: Map Click Handler expands WebGL clusters or closes drawer on empty canvas click
  const handleMapClick = function (e: any) {
    if (!mapRef.current) {
      setSelectedPin(null);
      return;
    }

    const renderedFeatures = mapRef.current.queryRenderedFeatures(e.point, {
      layers: INTERACTIVE_LAYER_IDS,
    });

    if (!renderedFeatures || renderedFeatures.length === 0) {
      setSelectedPin(null);
      return;
    }

    const topFeature: any = renderedFeatures[0];
    const layerId = topFeature.layer ? topFeature.layer.id : '';

    if (layerId === 'clusters') {
      const clusterId = topFeature.properties ? topFeature.properties.cluster_id : null;
      const pointGeometry: any = topFeature.geometry;
      const clusterCoords =
        pointGeometry && Array.isArray(pointGeometry.coordinates)
          ? pointGeometry.coordinates
          : null;

      const geoJsonSource: any = mapRef.current.getSource('pins');

      if (
        geoJsonSource &&
        typeof geoJsonSource.getClusterExpansionZoom === 'function' &&
        clusterId !== null &&
        clusterCoords
      ) {
        geoJsonSource.getClusterExpansionZoom(
          clusterId,
          function (err: any, expansionZoom: number) {
            if (!err && mapRef.current) {
              mapRef.current.flyTo({
                center: [clusterCoords[0], clusterCoords[1]],
                zoom: Math.min(expansionZoom + 0.5, 16),
                duration: 750,
                essential: true,
              });
            }
          }
        );
      } else if (clusterCoords) {
        const currentZoom = mapRef.current.getZoom() || 3;
        mapRef.current.flyTo({
          center: [clusterCoords[0], clusterCoords[1]],
          zoom: Math.min(currentZoom + 2.5, 16),
          duration: 750,
          essential: true,
        });
      }
    }
  };

  const handleMapMouseMove = function (e: any) {
    if (!mapRef.current) return;
    const hovered = mapRef.current.queryRenderedFeatures(e.point, {
      layers: INTERACTIVE_LAYER_IDS,
    });
    if (hovered && 0 < hovered.length) {
      setMapCursor('pointer');
    } else {
      setMapCursor('grab');
    }
  };

  const buildGoogleMapsUrl = function (pin: NormalizedPin) {
    const baseUrl = `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`;
    return pin.placeId ? `${baseUrl}&query_place_id=${encodeURIComponent(pin.placeId)}` : baseUrl;
  };

  const buildExactVerseUrl = function (pin: NormalizedPin) {
    const query = `${pin.artist} ${pin.songOrAlbum} official audio`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  };

  const formatTime = function (secs: number) {
    const clamped = Math.max(0, Math.min(30, secs));
    return `0:${clamped < 10 ? `0${clamped}` : clamped}`;
  };

  const isSelectedPinInTour = selectedPin ? isPinInTour(selectedPin.id) : false;
  const canOptimizeRoute = 2 <= tourStops.length;

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* TOP FILTER & CITY SEARCH BAR */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: selectedPin && !isMobile ? 416 : 16,
          zIndex: 10,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(15, 15, 20, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 12,
          padding: isMobile ? '10px 12px' : '12px 16px',
          transition: 'right 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: '#fff' }}>
            🎸 VerseMap
          </div>
          <span
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: '#a1a1aa',
            }}
          >
            {loading ? 'Loading pins...' : `${filteredPins.length} / ${pins.length} Pins`}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#18181b',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '3px 6px 3px 10px',
              gap: 6,
            }}
          >
            <input
              type="text"
              value={placeSearch}
              placeholder="Search city, street, or venue..."
              onChange={function (e) {
                setPlaceSearch(e.target.value);
              }}
              onKeyDown={function (e) {
                if (e.key === 'Enter') {
                  handleFlyToPlaceResults();
                }
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f4f4f5',
                fontSize: 12,
                width: isMobile ? 140 : 185,
              }}
            />
            {placeSearch !== '' && (
              <button
                onClick={function () {
                  setPlaceSearch('');
                }}
                title="Clear search"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '2px 4px',
                }}
              >
                ✕
              </button>
            )}
            <button
              onClick={handleFlyToPlaceResults}
              title="Fly to matching locations"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fde68a',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Fly
            </button>
          </div>

          <select
            value={selectedArtist}
            onChange={function (e) {
              setSelectedArtist(e.target.value);
            }}
            style={{
              backgroundColor: '#18181b',
              color: '#f4f4f5',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {artistOptions.map(function (artist) {
              return (
                <option key={artist} value={artist}>
                  {artist === 'ALL' ? 'All Artists' : artist}
                </option>
              );
            })}
          </select>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PIN_CATEGORIES.map(function (cat) {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={function () {
                    setSelectedCategory(cat.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: isMobile ? '5px 9px' : '6px 11px',
                    borderRadius: 8,
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isActive
                      ? `1px solid ${cat.color}`
                      : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.14)' : '#18181b',
                    color: isActive ? '#ffffff' : '#a1a1aa',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: cat.color,
                    }}
                  />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* LEFT-ALIGNED DOCK: ERA TIME-MACHINE + FLOATING TOUR BUS CART */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 16,
          right: isMobile ? 16 : 'auto',
          zIndex: 15,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            backgroundColor: 'rgba(15, 15, 20, 0.88)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 12,
            padding: 8,
            maxWidth: isMobile ? '92vw' : '68vw',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              fontSize: 11,
              fontWeight: 700,
              color: '#fbbf24',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            ⏳ Era Time-Machine:
          </div>
          {ERA_PRESETS.map(function (era) {
            const active = selectedEra === era.id;
            return (
              <button
                key={era.id}
                onClick={function () {
                  handleEraChange(era.id);
                }}
                title={era.description}
                style={{
                  padding: isMobile ? '6px 10px' : '7px 12px',
                  borderRadius: 8,
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: active ? '1px solid #f59e0b' : '1px solid transparent',
                  backgroundColor: active
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: active ? '#fde68a' : '#d4d4d8',
                }}
              >
                {era.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            pointerEvents: 'auto',
            width: isMobile ? '100%' : 355,
            maxWidth: '92vw',
            backgroundColor: 'rgba(15, 15, 20, 0.94)',
            backdropFilter: 'blur(14px)',
            border: isRouteOptimized
              ? '1px solid rgba(16, 185, 129, 0.6)'
              : 0 < tourStops.length
              ? '1px solid rgba(245, 158, 11, 0.5)'
              : '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={function () {
              setIsTourTrayOpen(!isTourTrayOpen);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              color: '#f4f4f5',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🚌</span>
              <span>
                {tourStops.length === 1
                  ? '1 Stop Selected'
                  : `${tourStops.length} Stops Selected`}
              </span>
              {isRouteOptimized && 2 <= tourStops.length && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(16, 185, 129, 0.18)',
                    color: '#34d399',
                    fontWeight: 700,
                  }}
                >
                  Optimized ({totalRouteKm.toFixed(1)} km)
                </span>
              )}
            </span>
            <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
              {isTourTrayOpen ? 'Hide Tray ▼' : 'View Itinerary ▲'}
            </span>
          </button>

          {isTourTrayOpen && (
            <div
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isRouteOptimized ? '#34d399' : '#a1a1aa',
                  }}
                >
                  {isRouteOptimized
                    ? '✓ Shortest-Path Sequence Ready'
                    : 'Tour Bus Itinerary'}
                </span>
                {0 < tourStops.length && (
                  <button
                    onClick={handleClearTourStops}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {tourStops.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: '#71717a',
                    padding: '8px 0',
                    lineHeight: 1.5,
                  }}
                >
                  Click any landmark pin on the map and tap{' '}
                  <strong style={{ color: '#e4e4e7' }}>➕ Add to Tour Bus</strong> (select at
                  least 2 stops) to generate an optimized route.
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: 165,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {tourStops.map(function (stop, index) {
                    return (
                      <div
                        key={stop.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          backgroundColor: '#18181c',
                          border: isRouteOptimized
                            ? '1px solid rgba(245, 158, 11, 0.28)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 8,
                          padding: '7px 10px',
                        }}
                      >
                        <div
                          onClick={function () {
                            setSelectedPin(stop);
                            if (mapRef.current) {
                              mapRef.current.flyTo({
                                center: [stop.lng, stop.lat],
                                zoom: 14.5,
                                duration: 900,
                              });
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            minWidth: 0,
                            flex: 1,
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              backgroundColor: isRouteOptimized ? '#10b981' : '#f59e0b',
                              color: '#09090b',
                              fontSize: 11,
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {index + 1}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#f4f4f5',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {stop.title}
                            </div>
                            <div style={{ fontSize: 10, color: '#a1a1aa' }}>
                              {index === 0
                                ? `Start • ${stop.artist}`
                                : index === tourStops.length - 1 && 1 < tourStops.length
                                ? `Finish • ${stop.artist}`
                                : stop.artist}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={function () {
                            handleRemoveTourStop(stop.id);
                          }}
                          title="Remove stop"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#71717a',
                            cursor: 'pointer',
                            fontSize: 13,
                            padding: '2px 4px',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {isRouteOptimized && canOptimizeRoute ? (
                <button
                  onClick={handleExportDirections}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#052e16',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    textAlign: 'center',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  🗺️ Export Directions to Google Maps ↗
                </button>
              ) : (
                <button
                  onClick={handleOptimizeRoute}
                  disabled={!canOptimizeRoute}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: canOptimizeRoute
                      ? 'none'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: canOptimizeRoute ? '#f59e0b' : '#27272a',
                    color: canOptimizeRoute ? '#09090b' : '#71717a',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: canOptimizeRoute ? 'pointer' : 'not-allowed',
                    textAlign: 'center',
                    boxShadow: canOptimizeRoute
                      ? '0 4px 14px rgba(245, 158, 11, 0.35)'
                      : 'none',
                  }}
                >
                  {canOptimizeRoute
                    ? '✨ Generate Optimized Route'
                    : '✨ Add 2+ Stops to Optimize Route'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            position: 'absolute',
            top: 90,
            left: 16,
            zIndex: 20,
            backgroundColor: '#7f1d1d',
            color: '#fecaca',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          Supabase Error: {errorMsg}
        </div>
      )}

      {/* HYBRID MAPBOX CANVAS: WebGL Cluster Bubbles + Custom HTML/SVG Category Markers */}
      <MapboxMap
        ref={mapRef}
        initialViewState={INITIAL_MAP_VIEW}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        style={MAP_CONTAINER_STYLE}
        interactiveLayerIds={INTERACTIVE_LAYER_IDS}
        cursor={mapCursor}
        onLoad={syncViewportState}
        onMove={syncViewportState}
        onMoveEnd={syncViewportState}
        onClick={handleMapClick}
        onMouseMove={handleMapMouseMove}
      >
        <NavigationControl position="bottom-right" />

        {routeGeoJson && (
          <Source id="tour-bus-route" type="geojson" data={routeGeoJson}>
            <Layer
              id="tour-bus-route-glow"
              type="line"
              layout={ROUTE_LINE_LAYOUT}
              paint={ROUTE_GLOW_PAINT}
            />
            <Layer
              id="tour-bus-route-dash"
              type="line"
              layout={ROUTE_LINE_LAYOUT}
              paint={ROUTE_DASH_PAINT}
            />
          </Source>
        )}

        {/* WebGL Cluster Bubbles Only (Unclustered WebGL circles removed) */}
        <Source
          id="pins"
          type="geojson"
          data={pinsGeoJson}
          cluster={true}
          clusterMaxZoom={CLUSTER_MAX_ZOOM}
          clusterRadius={CLUSTER_RADIUS_PX}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={CLUSTER_FILTER}
            paint={CLUSTER_CIRCLE_PAINT}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={CLUSTER_FILTER}
            layout={CLUSTER_COUNT_LAYOUT}
            paint={CLUSTER_COUNT_PAINT}
          />
        </Source>

        {/* Step 4.2: Custom HTML/SVG Markers for Visible Unclustered Pins + Tour Bus Stops */}
        {visibleHtmlPins.map(function (pin) {
          const pinColor = getCategoryColor(pin.category);
          const isSelected = selectedPin
            ? String(selectedPin.id) === String(pin.id)
            : false;
          const isHovered = hoveredPinId !== null && String(hoveredPinId) === String(pin.id);
          const stopNumber = getTourStopNumber(pin.id);
          const markerLat = pin.displayLat ?? pin.lat;
          const markerLng = pin.displayLng ?? pin.lng;

          let markerScale = 'scale(1)';
          if (isSelected) {
            markerScale = 'scale(1.3)';
          } else if (isHovered) {
            markerScale = 'scale(1.15)';
          }

          return (
            <Marker
              key={`custom-marker-${pin.id}`}
              latitude={markerLat}
              longitude={markerLng}
              anchor="bottom"
              onClick={function (e) {
                e.originalEvent.stopPropagation();
                setSelectedPin(pin);
                if (mapRef.current) {
                  mapRef.current.flyTo({
                    center: [pin.lng, pin.lat],
                    zoom: Math.max(mapRef.current.getZoom() || 11, 14),
                    duration: 900,
                  });
                }
              }}
            >
              <div
                title={`${pin.title} (${pin.artist})`}
                onMouseEnter={function () {
                  setHoveredPinId(pin.id);
                }}
                onMouseLeave={function () {
                  setHoveredPinId(null);
                }}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transform: markerScale,
                  transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
                  zIndex: isSelected ? 25 : isHovered ? 18 : stopNumber !== null ? 12 : 4,
                }}
              >
                {stopNumber !== null && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -7,
                      right: -7,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: isRouteOptimized ? '#10b981' : '#f59e0b',
                      color: '#09090b',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #09090b',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.65)',
                      zIndex: 6,
                    }}
                  >
                    {stopNumber}
                  </div>
                )}

                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    backgroundColor: '#121216',
                    border: isSelected
                      ? '2.5px solid #ffffff'
                      : `2.5px solid ${pinColor}`,
                    boxShadow: isSelected
                      ? `0 0 20px ${pinColor}, 0 0 8px #ffffff`
                      : isHovered
                      ? `0 0 14px ${pinColor}`
                      : `0 3px 10px rgba(0,0,0,0.75), 0 0 8px ${pinColor}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {renderCategorySvgIcon(pin.category, pinColor)}
                </div>

                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: isSelected
                      ? '8px solid #ffffff'
                      : `8px solid ${pinColor}`,
                    marginTop: -1,
                  }}
                />
              </div>
            </Marker>
          );
        })}
      </MapboxMap>

      {selectedPin && (
        <aside
          style={{
            position: 'absolute',
            top: isMobile ? 'auto' : 0,
            bottom: 0,
            right: 0,
            left: isMobile ? 0 : 'auto',
            width: isMobile ? '100%' : 400,
            maxWidth: isMobile ? '100vw' : '92vw',
            height: isMobile ? '60vh' : '100vh',
            zIndex: 30,
            backgroundColor: '#121216',
            borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.12)',
            borderTop: isMobile ? '1px solid rgba(255,255,255,0.18)' : 'none',
            borderRadius: isMobile ? '18px 18px 0 0' : 0,
            boxShadow: isMobile
              ? '0 -12px 30px rgba(0,0,0,0.75)'
              : '-12px 0 30px rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: isMobile ? '16px 20px 24px 20px' : 24,
            overflowY: 'auto',
          }}
        >
          <div>
            {isMobile && (
              <div
                style={{
                  width: 42,
                  height: 4,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: 999,
                  margin: '0 auto 14px auto',
                }}
              />
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: getCategoryColor(selectedPin.category),
                  border: `1px solid ${getCategoryColor(selectedPin.category)}`,
                }}
              >
                {selectedPin.category.replace('_', ' ')}
              </span>

              <button
                onClick={function () {
                  setSelectedPin(null);
                }}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#e4e4e7',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>

            <h2
              style={{
                fontSize: isMobile ? 20 : 22,
                fontWeight: 800,
                marginTop: 14,
                marginBottom: 6,
                lineHeight: 1.25,
              }}
            >
              {selectedPin.title}
            </h2>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#a1a1aa', marginBottom: 16 }}>
              {selectedPin.artist}
              {selectedPin.songOrAlbum ? ` • ${selectedPin.songOrAlbum}` : ''}
              {selectedPin.releaseYear ? ` (${selectedPin.releaseYear})` : ''}
            </div>

            {selectedPin.category !== 'LYRIC_MENTION' && pinVisualUrl && (
              <div
                style={{
                  marginBottom: 18,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backgroundColor: '#18181c',
                }}
              >
                <img
                  src={pinVisualUrl}
                  alt={selectedPin.title}
                  style={{
                    width: '100%',
                    height: selectedPin.category === 'ALBUM_COVER' ? 240 : 185,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div
                  style={{
                    padding: '7px 12px',
                    fontSize: 11,
                    color: '#a1a1aa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {selectedPin.category === 'ALBUM_COVER'
                      ? '📸 Official Album Cover Sleeve'
                      : selectedPin.category === 'TRIBUTE_MURAL'
                      ? '🎨 Tribute & Landmark Photo'
                      : '🏛️ Historic Venue & Site Photo'}
                  </span>
                  <span>{selectedPin.artist}</span>
                </div>
              </div>
            )}

            {function () {
              const badge = getSurvivalBadge(selectedPin.siteStatus, selectedPin.businessStatus);
              return (
                <div
                  style={{
                    backgroundColor: badge.bg,
                    border: `1px solid ${badge.border}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#a1a1aa',
                      marginBottom: 4,
                    }}
                  >
                    Then vs. Now Survival Status
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 700,
                      fontSize: 14,
                      color: badge.text,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        backgroundColor: badge.dot,
                      }}
                    />
                    {badge.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>
                    Verified Status: {badge.subtext}
                  </div>
                </div>
              );
            }()}

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#71717a',
                  marginBottom: 8,
                }}
              >
                Origin & Historical Lore
              </div>
              <div
                style={{
                  backgroundColor: '#18181c',
                  borderLeft: `3px solid ${getCategoryColor(selectedPin.category)}`,
                  padding: '14px 16px',
                  borderRadius: '0 8px 8px 0',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: '#e4e4e7',
                }}
              >
                {selectedPin.lyricOrContext}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#18181c',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: 14,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#a1a1aa',
                  }}
                >
                  🎵 30s Hook Preview
                </span>
                <span style={{ fontSize: 10, color: '#34d399', fontWeight: 600 }}>
                  {audioLoading
                    ? 'Matching track...'
                    : audioUrl
                    ? '✓ Verified Artist & Track'
                    : 'Use Full Track Link Below'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={handleToggleAudio}
                  disabled={audioLoading || !audioUrl}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: audioLoading || !audioUrl ? '#27272a' : '#f59e0b',
                    color: audioLoading || !audioUrl ? '#71717a' : '#09090b',
                    fontWeight: 800,
                    cursor: audioLoading || !audioUrl ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {audioLoading ? '•••' : isPlayingPreview ? '❚❚' : '▶'}
                </button>

                {audioArtwork && (
                  <img
                    src={audioArtwork}
                    alt="Album Art"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 6,
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#f4f4f5',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {audioLoading ? 'Loading track...' : audioTrackName}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 6,
                      backgroundColor: '#27272a',
                      borderRadius: 999,
                      marginTop: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${audioProgress}%`,
                        height: '100%',
                        backgroundColor: '#f59e0b',
                        transition: 'width 0.2s linear',
                      }}
                    />
                  </div>
                </div>

                <span style={{ fontSize: 11, color: '#71717a', flexShrink: 0 }}>
                  {isPlayingPreview || 0 < audioCurrentTime
                    ? `${formatTime(audioCurrentTime)} / 0:30`
                    : '0:30'}
                </span>
              </div>

              {selectedPin.exactVerseTimestamp && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: '#d4d4d8' }}>
                    🎯 Iconic Moment: <strong>{selectedPin.exactVerseTimestamp}</strong>
                  </span>
                  <a
                    href={buildExactVerseUrl(selectedPin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#fbbf24',
                      textDecoration: 'none',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Full Track ↗
                  </a>
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: '#71717a', marginBottom: 18 }}>
              <div>
                Coordinates: {selectedPin.lat.toFixed(5)}, {selectedPin.lng.toFixed(5)}
              </div>
              {selectedPin.rawQuery && (
                <div style={{ marginTop: 4 }}>Location: {selectedPin.rawQuery}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={function () {
                handleToggleTourStop(selectedPin);
              }}
              style={{
                width: '100%',
                textAlign: 'center',
                backgroundColor: isSelectedPinInTour
                  ? 'rgba(239, 68, 68, 0.16)'
                  : '#f59e0b',
                color: isSelectedPinInTour ? '#f87171' : '#09090b',
                border: isSelectedPinInTour
                  ? '1px solid rgba(239, 68, 68, 0.5)'
                  : 'none',
                fontWeight: 800,
                fontSize: 14,
                padding: '13px 16px',
                borderRadius: 10,
                cursor: 'pointer',
                boxShadow: isSelectedPinInTour
                  ? 'none'
                  : '0 4px 14px rgba(245, 158, 11, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {isSelectedPinInTour ? '❌ Remove from Tour Bus' : '➕ Add to Tour Bus'}
            </button>

            <a
              href={buildGoogleMapsUrl(selectedPin)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                textAlign: 'center',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
                padding: '13px 16px',
                borderRadius: 10,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
              }}
            >
              📍 Open in Google Maps ↗
            </a>
          </div>
        </aside>
      )}
    </div>
  );
}