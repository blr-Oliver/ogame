var token = 'a082fcc83b3c4792c179fbdbb089f5c5';

var checkTargetUrl = 'https:\\/\\/s156-en.ogame.gameforge.com\\/game\\/index.php?page=ingame&component=fleetdispatch&action=checkTarget&ajax=1&asJson=1'
var sendFleetUrl = 'https:\\/\\/s156-en.ogame.gameforge.com\\/game\\/index.php?page=ingame&component=fleetdispatch&action=sendFleet&ajax=1&asJson=1'
var saveSettingsUrl = 'https:\\/\\/s156-en.ogame.gameforge.com\\/game\\/index.php?page=ingame&component=fleetdispatch&action=saveFleetBoxOrderSettings&ajax=1&asJson=1'

var fleetBoxOrder = {'fleetboxdestination': 0, 'fleetboxmission': 1, 'fleetboxbriefingandresources': 2}

var FLEET_DEUTERIUM_SAVE_FACTOR = 1;
var maxNumberOfPlanets = 5;
var shipsData = {
  '204': {
    'id': 204,
    'name': 'Light Fighter',
    'baseFuelConsumption': 20,
    'baseFuelCapacity': 70,
    'baseCargoCapacity': 70,
    'fuelConsumption': 20,
    'baseSpeed': 12500,
    'speed': 20000,
    'cargoCapacity': 70,
    'fuelCapacity': 70,
    'number': 1,
    'recycleMode': 0
  },
  '205': {
    'id': 205,
    'name': 'Heavy Fighter',
    'baseFuelConsumption': 75,
    'baseFuelCapacity': 140,
    'baseCargoCapacity': 140,
    'fuelConsumption': 75,
    'baseSpeed': 10000,
    'speed': 20000,
    'cargoCapacity': 140,
    'fuelCapacity': 140,
    'number': 1,
    'recycleMode': 0
  },
  '206': {
    'id': 206,
    'name': 'Cruiser',
    'baseFuelConsumption': 300,
    'baseFuelCapacity': 1120,
    'baseCargoCapacity': 1120,
    'fuelConsumption': 300,
    'baseSpeed': 15000,
    'speed': 30000,
    'cargoCapacity': 1120,
    'fuelCapacity': 1120,
    'number': 1,
    'recycleMode': 0
  },
  '207': {
    'id': 207,
    'name': 'Battleship',
    'baseFuelConsumption': 500,
    'baseFuelCapacity': 2100,
    'baseCargoCapacity': 2100,
    'fuelConsumption': 500,
    'baseSpeed': 10000,
    'speed': 16000,
    'cargoCapacity': 2100,
    'fuelCapacity': 2100,
    'number': 1,
    'recycleMode': 0
  },
  '215': {
    'id': 215,
    'name': 'Battlecruiser',
    'baseFuelConsumption': 250,
    'baseFuelCapacity': 1050,
    'baseCargoCapacity': 1050,
    'fuelConsumption': 250,
    'baseSpeed': 10000,
    'speed': 16000,
    'cargoCapacity': 1050,
    'fuelCapacity': 1050,
    'number': 1,
    'recycleMode': 0
  },
  '211': {
    'id': 211,
    'name': 'Bomber',
    'baseFuelConsumption': 700,
    'baseFuelCapacity': 700,
    'baseCargoCapacity': 700,
    'fuelConsumption': 700,
    'baseSpeed': 4000,
    'speed': 8000,
    'cargoCapacity': 700,
    'fuelCapacity': 700,
    'number': 1,
    'recycleMode': 0
  },
  '213': {
    'id': 213,
    'name': 'Destroyer',
    'baseFuelConsumption': 1000,
    'baseFuelCapacity': 2800,
    'baseCargoCapacity': 2800,
    'fuelConsumption': 1000,
    'baseSpeed': 5000,
    'speed': 8000,
    'cargoCapacity': 2800,
    'fuelCapacity': 2800,
    'number': 1,
    'recycleMode': 0
  },
  '214': {
    'id': 214,
    'name': 'Deathstar',
    'baseFuelConsumption': 1,
    'baseFuelCapacity': 1400000,
    'baseCargoCapacity': 1400000,
    'fuelConsumption': 1,
    'baseSpeed': 100,
    'speed': 160,
    'cargoCapacity': 1400000,
    'fuelCapacity': 1400000,
    'number': 1,
    'recycleMode': 0
  },
  '218': {
    'id': 218,
    'name': 'Reaper',
    'baseFuelConsumption': 1100,
    'baseFuelCapacity': 14000,
    'baseCargoCapacity': 14000,
    'fuelConsumption': 1100,
    'baseSpeed': 7000,
    'speed': 11200,
    'cargoCapacity': 14000,
    'fuelCapacity': 14000,
    'number': 1,
    'recycleMode': 2
  },
  '219': {
    'id': 219,
    'name': 'Pathfinder',
    'baseFuelConsumption': 300,
    'baseFuelCapacity': 14000,
    'baseCargoCapacity': 14000,
    'fuelConsumption': 300,
    'baseSpeed': 12000,
    'speed': 19200,
    'cargoCapacity': 14000,
    'fuelCapacity': 14000,
    'number': 1,
    'recycleMode': 3
  },
  '202': {
    'id': 202,
    'name': 'Small Cargo',
    'baseFuelConsumption': 20,
    'baseFuelCapacity': 7000,
    'baseCargoCapacity': 7000,
    'fuelConsumption': 20,
    'baseSpeed': 10000,
    'speed': 20000,
    'cargoCapacity': 7000,
    'fuelCapacity': 7000,
    'number': 1,
    'recycleMode': 0
  },
  '203': {
    'id': 203,
    'name': 'Large Cargo',
    'baseFuelConsumption': 50,
    'baseFuelCapacity': 35000,
    'baseCargoCapacity': 35000,
    'fuelConsumption': 50,
    'baseSpeed': 7500,
    'speed': 12000,
    'cargoCapacity': 35000,
    'fuelCapacity': 35000,
    'number': 1,
    'recycleMode': 0
  },
  '208': {
    'id': 208,
    'name': 'Colony Ship',
    'baseFuelConsumption': 1000,
    'baseFuelCapacity': 10500,
    'baseCargoCapacity': 10500,
    'fuelConsumption': 1000,
    'baseSpeed': 2500,
    'speed': 5000,
    'cargoCapacity': 10500,
    'fuelCapacity': 10500,
    'number': 1,
    'recycleMode': 0
  },
  '209': {
    'id': 209,
    'name': 'Recycler',
    'baseFuelConsumption': 300,
    'baseFuelCapacity': 28000,
    'baseCargoCapacity': 28000,
    'fuelConsumption': 300,
    'baseSpeed': 2000,
    'speed': 3200,
    'cargoCapacity': 28000,
    'fuelCapacity': 28000,
    'number': 1,
    'recycleMode': 0
  },
  '210': {
    'id': 210,
    'name': 'Espionage Probe',
    'baseFuelConsumption': 1,
    'baseFuelCapacity': 7,
    'baseCargoCapacity': 0,
    'fuelConsumption': 1,
    'baseSpeed': 100000000,
    'speed': 160000000,
    'cargoCapacity': 0,
    'fuelCapacity': 7,
    'number': 1,
    'recycleMode': 0
  },
  '217': {
    'id': 217,
    'name': 'Crawler',
    'baseFuelConsumption': 0,
    'baseFuelCapacity': 0,
    'baseCargoCapacity': 0,
    'fuelConsumption': 1,
    'baseSpeed': 0,
    'speed': 0,
    'cargoCapacity': 0,
    'fuelCapacity': 0,
    'number': 1,
    'recycleMode': 0
  }
};

var speed = 100

var PLAYER_ID_SPACE = 99999;
var PLAYER_ID_LEGOR = 1;
var DONUT_GALAXY = 1;
var DONUT_SYSTEM = 1;
var MAX_GALAXY = 9;
var MAX_SYSTEM = 499;
var MAX_POSITION = 16;
var SPEEDFAKTOR_FLEET_PEACEFUL = 1;
var SPEEDFAKTOR_FLEET_WAR = 1;
var SPEEDFAKTOR_FLEET_HOLDING = 1;
var PLANETTYPE_PLANET = 1;
var PLANETTYPE_DEBRIS = 2;
var PLANETTYPE_MOON = 3;
var EXPEDITION_POSITION = 16;
var MAX_NUMBER_OF_PLANETS = 5;
var COLONIZATION_ENABLED = true;

var missions = {
  'MISSION_NONE': 0,
  'MISSION_ATTACK': 1,
  'MISSION_UNIONATTACK': 2,
  'MISSION_TRANSPORT': 3,
  'MISSION_DEPLOY': 4,
  'MISSION_HOLD': 5,
  'MISSION_ESPIONAGE': 6,
  'MISSION_COLONIZE': 7,
  'MISSION_RECYCLE': 8,
  'MISSION_DESTROY': 9,
  'MISSION_MISSILEATTACK': 10,
  'MISSION_EXPEDITION': 15
};
var orderNames = {
  '15': 'Expedition',
  '7': 'Colonisation',
  '8': 'Recycle debris field',
  '3': 'Transport',
  '4': 'Deployment',
  '6': 'Espionage',
  '5': 'ACS Defend',
  '1': 'Attack',
  '2': 'ACS Attack',
  '9': 'Moon Destruction'
};
var orderDescriptions = {
  '1': 'Attacks the fleet and defence of your opponent.',
  '2': 'Honourable battles can become dishonourable battles if strong players enter through ACS. The attacker`s sum of total military points in comparison to the defender`s sum of total military points is the decisive factor here.',
  '3': 'Transports your resources to other planets.',
  '4': 'Sends your fleet permanently to another planet of your empire.',
  '5': 'Defend the planet of your team-mate.',
  '6': 'Spy the worlds of foreign emperors.',
  '7': 'Colonizes a new planet.',
  '8': 'Send your recyclers to a debris field to collect the resources floating around there.',
  '9': 'Destroys the moon of your enemy.',
  '15': 'Send your ships into the final frontier of space to encounter thrilling quests.'
};

var currentPlanet = {'galaxy': 6, 'system': 36, 'position': 12, 'type': 1, 'name': 'Colony'};
var targetPlanet = {'galaxy': 6, 'system': 36, 'position': 12, 'type': 1, 'name': 'Colony'};
var shipsOnPlanet = [
  {
    'id': 202,
    'name': 'Small Cargo',
    'baseFuelConsumption': 20,
    'baseFuelCapacity': 7000,
    'baseCargoCapacity': 7000,
    'fuelConsumption': 4680,
    'baseSpeed': 10000,
    'speed': 20000,
    'cargoCapacity': 1638000,
    'fuelCapacity': 1638000,
    'number': 234,
    'recycleMode': 0
  },
  {
    'id': 203,
    'name': 'Large Cargo',
    'baseFuelConsumption': 50,
    'baseFuelCapacity': 35000,
    'baseCargoCapacity': 35000,
    'fuelConsumption': 2700,
    'baseSpeed': 7500,
    'speed': 12000,
    'cargoCapacity': 1890000,
    'fuelCapacity': 1890000,
    'number': 54,
    'recycleMode': 0
  },
  {
    'id': 207,
    'name': 'Battleship',
    'baseFuelConsumption': 500,
    'baseFuelCapacity': 2100,
    'baseCargoCapacity': 2100,
    'fuelConsumption': 4500,
    'baseSpeed': 10000,
    'speed': 16000,
    'cargoCapacity': 18900,
    'fuelCapacity': 18900,
    'number': 9,
    'recycleMode': 0
  },
  {
    'id': 209,
    'name': 'Recycler',
    'baseFuelConsumption': 300,
    'baseFuelCapacity': 28000,
    'baseCargoCapacity': 28000,
    'fuelConsumption': 3000,
    'baseSpeed': 2000,
    'speed': 3200,
    'cargoCapacity': 280000,
    'fuelCapacity': 280000,
    'number': 10,
    'recycleMode': 0
  },
  {
    'id': 210,
    'name': 'Espionage Probe',
    'baseFuelConsumption': 1,
    'baseFuelCapacity': 7,
    'baseCargoCapacity': 0,
    'fuelConsumption': 244,
    'baseSpeed': 100000000,
    'speed': 160000000,
    'cargoCapacity': 0,
    'fuelCapacity': 1708,
    'number': 244,
    'recycleMode': 0
  },
  {
    'id': 213,
    'name': 'Destroyer',
    'baseFuelConsumption': 1000,
    'baseFuelCapacity': 2800,
    'baseCargoCapacity': 2800,
    'fuelConsumption': 9000,
    'baseSpeed': 5000,
    'speed': 8000,
    'cargoCapacity': 25200,
    'fuelCapacity': 25200,
    'number': 9,
    'recycleMode': 0
  },
  {
    'id': 215,
    'name': 'Battlecruiser',
    'baseFuelConsumption': 250,
    'baseFuelCapacity': 1050,
    'baseCargoCapacity': 1050,
    'fuelConsumption': 500,
    'baseSpeed': 10000,
    'speed': 16000,
    'cargoCapacity': 2100,
    'fuelCapacity': 2100,
    'number': 2,
    'recycleMode': 0
  },
  {
    'id': 218,
    'name': 'Reaper',
    'baseFuelConsumption': 1100,
    'baseFuelCapacity': 14000,
    'baseCargoCapacity': 14000,
    'fuelConsumption': 1100,
    'baseSpeed': 7000,
    'speed': 11200,
    'cargoCapacity': 14000,
    'fuelCapacity': 14000,
    'number': 1,
    'recycleMode': 2
  },
  {
    'id': 219,
    'name': 'Pathfinder',
    'baseFuelConsumption': 300,
    'baseFuelCapacity': 14000,
    'baseCargoCapacity': 14000,
    'fuelConsumption': 300,
    'baseSpeed': 12000,
    'speed': 19200,
    'cargoCapacity': 14000,
    'fuelCapacity': 14000,
    'number': 1,
    'recycleMode': 3
  }];
var useHalfSteps = false;
var shipsToSend = [];
var planets = [{'galaxy': 6, 'system': 36, 'position': 12, 'type': 1, 'name': 'Colony'},
  {'galaxy': 7, 'system': 337, 'position': 10, 'type': 1, 'name': 'Homeworld'},
  {'galaxy': 7, 'system': 329, 'position': 12, 'type': 1, 'name': 'Colony'},
  {'galaxy': 5, 'system': 499, 'position': 3, 'type': 1, 'name': 'Colony'}];
var standardFleets = [];
var unions = [];

var mission = 0;
var unionID = 0;
var speed = 10;

var missionHold = 5;
var missionExpedition = 15;

var holdingTime = 1;
var expeditionTime = 0;

var metalOnPlanet = 11586385;
var crystalOnPlanet = 667983;
var deuteriumOnPlanet = 818077;

var fleetCount = 4;
var maxFleetCount = 11;
var expeditionCount = 4;
var maxExpeditionCount = 4;

var warningsEnabled = false;

var playerId = 117033;
var hasAdmiral = false;
var hasCommander = false;
var isOnVacation = false;

var moveInProgress = false;
var planetCount = 4;
var explorationCount = 4;

var apiCommonData = [['coords', '6:36:12'], ['characterClassId', 3]];
var apiTechData = [[109, 6], [110, 6], [111, 6], [115, 6], [117, 5], [118, 2], [114, 8]];
var apiDefenseData = [];

var loca = {
  'LOCA_FLEET_TITLE_MOVEMENTS': 'To fleet movement',
  'LOCA_FLEET_MOVEMENT': 'Fleet movement',
  'LOCA_FLEET_EDIT_STANDARTFLEET': 'Edit standard fleets',
  'LOCA_FLEET_STANDARD': 'Standard fleets',
  'LOCA_FLEET_HEADLINE_ONE': 'Fleet Dispatch I',
  'LOCA_FLEET_TOOLTIPP_SLOTS': 'Used\\/Total fleet slots',
  'LOCA_FLEET_FLEETSLOTS': 'Fleets',
  'LOCA_FLEET_NO_FREE_SLOTS': 'No fleet slots available',
  'LOCA_FLEETSENDING_NO_TARGET': 'You have to select a valid target.',
  'LOCA_FLEET_TOOLTIPP_EXP_SLOTS': 'Used\\/Total expedition slots',
  'LOCA_FLEET_EXPEDITIONS': 'Expeditions',
  'LOCA_ALL_NEVER': 'Never',
  'LOCA_FLEET_SEND_NOTAVAILABLE': 'Fleet dispatch impossible',
  'LOCA_FLEET_NO_SHIPS_ON_PLANET': 'There are no ships on this planet.',
  'LOCA_SHIPYARD_HEADLINE_BATTLESHIPS': 'Combat ships',
  'LOCA_SHIPYARD_HEADLINE_CIVILSHIPS': 'Civil ships',
  'LOCA_FLEET_SELECT_SHIPS_ALL': 'Select all ships',
  'LOCA_FLEET_SELECTION_RESET': 'Reset choice',
  'LOCA_API_FLEET_DATA': 'This data can be entered into a compatible combat simulator:',
  'LOCA_ALL_BUTTON_FORWARD': 'Next',
  'LOCA_FLEET_NO_SELECTION': 'Nothing has been selected',
  'LOCA_ALL_TACTICAL_RETREAT': 'Tactical retreat',
  'LOCA_FLEET1_TACTICAL_RETREAT_CONSUMPTION_TOOLTIP': 'Show Deuterium usage per tactical retreat',
  'LOCA_FLEET_FUEL_CONSUMPTION': 'Deuterium consumption',
  'LOCA_FLEET_ERROR_OWN_VACATION': 'No fleets can be sent from vacation mode!',
  'LOCA_FLEET_CURRENTLY_OCCUPIED': 'The fleet is currently in combat.',
  'LOCA_FLEET_FREE_MARKET_SLOTS': 'Offers',
  'LOCA_FLEET_TOOLTIPP_FREE_MARKET_SLOTS': 'Used\\/Total trading fleets',
  'LOCA_FLEET_HEADLINE_TWO': 'Fleet Dispatch II',
  'LOCA_FLEET_TAKEOFF_PLACE': 'Take off location',
  'LOCA_FLEET_TARGET_PLACE': 'Destination',
  'LOCA_ALL_PLANET': 'Planet',
  'LOCA_ALL_MOON': 'Moon',
  'LOCA_FLEET_COORDINATES': 'Coordinates',
  'LOCA_FLEET_DISTANCE': 'Distance',
  'LOCA_FLEET_DEBRIS': 'debris field',
  'LOCA_FLEET_SHORTLINKS': 'Shortcuts',
  'LOCA_FLEET_FIGHT_ASSOCIATION': 'Combat forces',
  'LOCA_FLEET_BRIEFING': 'Briefing',
  'LOCA_FLEET_DURATION_ONEWAY': 'Duration of flight (one way)',
  'LOCA_FLEET_SPEED': 'Speed:',
  'LOCA_FLEET_SPEED_MAX_SHORT': 'max.',
  'LOCA_FLEET_ARRIVAL': 'Arrival',
  'LOCA_FLEET_TIME_CLOCK': 'Clock',
  'LOCA_FLEET_RETURN': 'Return',
  'LOCA_FLEET_HOLD_FREE': 'Empty cargobays',
  'LOCA_ALL_BUTTON_BACK': 'Back',
  'LOCA_FLEET_PLANET_UNHABITATED': 'Uninhabited planet',
  'LOCA_FLEET_NO_DEBIRS_FIELD': 'No debris field',
  'LOCA_FLEET_PLAYER_UMODE': 'Player in vacation mode',
  'LOCA_FLEET_ADMIN': 'Admin or GM',
  'LOCA_ALL_NOOBSECURE': 'Noob protection',
  'LOCA_GALAXY_ERROR_STRONG': 'This planet can not be attacked as the player is to strong!',
  'LOCA_FLEET_NO_MOON': 'No moon available.',
  'LOCA_FLEET_NO_RECYCLER': 'No recycler available.',
  'LOCA_ALL_NO_EVENT': 'There are currently no events running.',
  'LOCA_PLANETMOVE_ERROR_ALREADY_RESERVED': 'This planet has already been reserved for a relocation.',
  'LOCA_FLEET_ERROR_TARGET_MSG': 'Fleets can not be sent to this target.',
  'LOCA_FLEETSENDING_NOT_ENOUGH_FOIL': 'Not enough deuterium!',
  'LOCA_FLEET_HEADLINE_THREE': 'Fleet Dispatch III',
  'LOCA_FLEET_TARGET_FOR_MISSION': 'Select mission for target',
  'LOCA_FLEET_MISSION': 'Mission',
  'LOCA_FLEET_RESOURCE_LOAD': 'Load resources',
  'LOCA_FLEET_SELECTION_NOT_AVAILABLE': 'You cannot start this mission.',
  'LOCA_FLEET_RETREAT_AFTER_DEFENDER_RETREAT_TOOLTIP': 'If this option is activated, your fleet will also withdraw without a fight if your opponent flees.',
  'LOCA_FLEET_RETREAT_AFTER_DEFENDER_RETREAT': 'Return upon retreat by defenders',
  'LOCA_FLEET_TARGET': 'Target',
  'LOCA_FLEET_DURATION_FEDERATION': 'Flight Duration (fleet union)',
  'LOCA_ALL_TIME_HOUR': 'h',
  'LOCA_FLEET_HOLD_TIME': 'Hold time',
  'LOCA_FLEET_EXPEDITION_TIME': 'Duration of expedition',
  'LOCA_ALL_METAL': 'Metal',
  'LOCA_ALL_CRYSTAL': 'Crystal',
  'LOCA_ALL_DEUTERIUM': 'Deuterium',
  'LOCA_FLEET_LOAD_ROOM': 'cargo bay',
  'LOCA_FLEET_CARGO_SPACE': 'Available space \\/ Max. cargo space',
  'LOCA_FLEET_SEND': 'Send fleet',
  'LOCA_ALL_NETWORK_ATTENTION': 'Caution',
  'LOCA_PLANETMOVE_BREAKUP_WARNING': 'Caution! This mission may still be running once the relocation period starts and if this is the case, the process will be cancelled. Do you really want to continue with this job?',
  'LOCA_ALL_YES': 'yes',
  'LOCA_ALL_NO': 'No',
  'LOCA_ALL_NOTICE': 'Reference',
  'LOCA_FLEETSENDING_MAX_PLANET_WARNING': 'Attention! No further planets may be colonised at the moment. Two levels of astrotechnology research are necessary for each new colony. Do you still want to send your fleet?',
  'LOCA_ALL_PLAYER': 'Player',
  'LOCA_FLEET_RESOURCES_ALL_LOAD': 'Load all resources',
  'LOCA_FLEET_RESOURCES_ALL': 'all resources',
  'LOCA_NETWORK_USERNAME': 'Players Name',
  'LOCA_EVENTH_ENEMY_INFINITELY_SPACE': 'deep space',
  'LOCA_FLEETSENDING_NO_MISSION_SELECTED': 'No mission selected!'
};
var locadyn = {
  'locaAllOutlawWarning': 'You are about to attack a stronger player. If you do this, your attack defences will be shut down for 7 days and all players will be able to attack you without punishment. Are you sure you want to continue?',
  'localBashWarning': 'In this universe, 0 attacks are permitted within a 24-hour period. This attack would probably exceed this limit. Do you really wish to launch it?',
  'locaOfficerbonusTooltipp': '+ 2 Fleet slots because of Admiral'
};
var errorCodeMap = {
  '601': 'An error has occurred',
  '602': 'Error, there is no moon',
  '603': 'Error, player can`t be approached because of newbie protection',
  '604': 'Player is too strong to be attacked',
  '605': 'Error, player is in vacation mode',
  '606': 'No fleets can be sent from vacation mode!',
  '610': 'Error, not enough ships available, send maximum number:',
  '611': 'Error, no ships available',
  '612': 'Error, no free fleet slots available',
  '613': 'Error, you don`t have enough deuterium',
  '614': 'Error, there is no planet there',
  '615': 'Error, not enough cargo capacity',
  '616': 'Multi-alarm',
  '617': 'Admin or GM',
  '618': 'Attack ban until 01.01.1970 01:00:00'
};

var fleetDispatcher = null;

$(function () {
  fleetDispatcher = new FleetDispatcher(window);
  fleetDispatcher.init();
});
