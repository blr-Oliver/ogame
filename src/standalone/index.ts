import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {Cookie} from 'tough-cookie';
import {defaultAnalyzer} from './core/Analyzer';
import {AutoRaid} from './core/AutoRaid';
import {Mapper} from './core/Mapper';
import {Scanner} from './core/Scanner';
import {CoordinateType} from '../common/types';
import {EspionageRepository} from './repository/EspionageRepository';
import {GalaxyRepository} from './repository/GalaxyRepository';

const app = express();
const port = 8080;

// TODO init (and inject?) all components
app.use(express.static(path.join(__dirname, 'public')));
app.set('json replacer', function (this: any, key: string, value: any) {
  if (this[key] instanceof Date) // direct test on value doesn't work
    return this[key].getTime();
  return value;
});

app.all('/*', useCookiesIfPresent, addCORSHeader);

app.get('/login', (req, res, next) => {
  Mapper.instance.loginLobby().then(result => {
    res.send(result);
  }).then(next);
});

app.get('/display/galaxy/:galaxy/:system', (req, res) => {
  GalaxyRepository.instance.load(+req.params['galaxy'], +req.params['system']).then(systemInfo => {
    res.json(systemInfo);
  });
});

app.get('/display/report/:galaxy/:system/:position/:type?', (req, res) => {
  let type: CoordinateType = +(req.params['type'] || CoordinateType.Planet);
  EspionageRepository.instance.load(+req.params['galaxy'], +req.params['system'], +req.params['position'], type).then(report => {
    res.json(report);
  });
});

app.get('/cookies', (req, res) => {
  if ('url' in req.query) {
    let cookies: Cookie[] = Mapper.instance.requestJar.getCookies(String(req.query['url']));
    if ('relay' in req.query) {
      let relayCode = cookies.map(c => `document.cookie="${[`${c.key}=${c.value}`, `path=${c.path}`].join('; ')}";`).join('\n');
      res.send(relayCode);
    } else {
      res.json({cookies});
    }
  } else
    res.json(Mapper.instance.jar);
});

app.get('/ping', (req, res, next) => {
  Mapper.instance.ping().then(response => {
    let statusCode = response.statusCode;
    console.log(`ping -> ${statusCode}`);
    res.json(statusCode);
  }).then(next);
});

app.get('/galaxy', (req, res) => {
  let galaxyParams: string | string[] = req.query['galaxy'] as (string | string[]);
  let systemParams: string | string[] = req.query['system'] as (string | string[]);
  if (typeof (galaxyParams) === 'string')
    galaxyParams = [galaxyParams];
  if (typeof (systemParams) === 'string')
    systemParams = [systemParams];
  if (galaxyParams) {
    let galaxy = galaxyParams.map(x => ~~(+x)).filter(x => x >= 1 && x <= 7);
    if (galaxy.length) {
      Mapper.instance.observe.galaxyMin = Math.min(...galaxy);
      Mapper.instance.observe.galaxyMax = Math.max(...galaxy);
    }
  }
  if (systemParams) {
    let system = systemParams.map(x => ~~(+x)).filter(x => x >= 1 && x <= 499);
    if (system.length) {
      Mapper.instance.observe.systemMin = Math.min(...system);
      Mapper.instance.observe.systemMax = Math.max(...system);
    }
  }

  if ('pause' in req.query) {
    Mapper.instance.observe.pause = true;
  } else if ('continue' in req.query) {
    Mapper.instance.observe.pause = false;
    Mapper.instance.continueObserve();
  }

  res.json(Mapper.instance.observe);
});


app.get('/raid', (req, res) => {
  if ('slots' in req.query)
    AutoRaid.instance.state.maxSlots = +req.query['slots']!;
  if ('continue' in req.query) {
    AutoRaid.instance.continue();
    res.status(202);
  }
  res.json(AutoRaid.instance.state);
});

app.get('/dump', (req, res) => {
  let field: string | string[] = req.query['field'] as (string | string[]);
  let path: string | string[] = req.query['path'] as (string | string[]);
  if (typeof field === 'string')
    field = [field];
  if (typeof path === 'string')
    path = [path];

  if (!field || !field.length)
    res.status(400).send('Expected "field" request param');
  else {
    let value: any = (Mapper.instance as any)[field[0]];
    if (path && path.length) {
      fs.writeFile(path[0], JSON.stringify(value), 'utf8', (err) => {
        if (err)
          res.status(500).json(err);
        else
          res.send(path[0]);
      });
    } else
      res.json(value);
  }
});

app.get('/espionage', (req, res) => {
  if ('continue' in req.query)
    Mapper.instance.loadAllReports();
  res.json(Mapper.instance.reportIdList);
});

app.get('/scan', (req, res) => {
  if ('load' in req.query)
    GalaxyRepository.instance.findInactiveTargets().then(
        targets => Scanner.instance.targets = targets);
  else if ('continue' in req.query) {
    Scanner.instance.launchNext()
  }
  res.json(Scanner.instance);
});

app.get('/analyze', (req, res) => {
  if ('load' in req.query)
    defaultAnalyzer.load();
  else if ('scan' in req.query)
    defaultAnalyzer.scan(+req.query['scan']!);
  else if ('launch' in req.query)
    defaultAnalyzer.launch(+req.query['launch']!);

  res.json(defaultAnalyzer.reports);
});

app.get('/events', (req, res) => {
  Mapper.instance.loadEvents().then(events => res.json(events));
});

app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});

function useCookiesIfPresent(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method !== 'OPTIONS' && req.method !== 'HEAD') {
    let queryCookie = req.query['cookie'] as string,
        bodyCookie = null, mergedCookies: string[] = [];
    if (req.method !== 'GET')
      bodyCookie = req.params['cookie'];
    if (queryCookie)
      mergedCookies = mergedCookies.concat(queryCookie);
    if (bodyCookie)
      mergedCookies = mergedCookies.concat(bodyCookie);
    if (mergedCookies.length)
      Mapper.instance.useCookie(mergedCookies, (req.params['url'] || req.query['url'] || req.headers.referer) as string);
  }
  next();
}

function addCORSHeader(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('access-control-allow-origin', `https://${Mapper.GAME_DOMAIN}`);
  next();
}
