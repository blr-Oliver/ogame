import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {Cookie} from 'tough-cookie';
import {Analyzer} from '../standalone/core/Analyzer';
import {AutoRaid} from '../standalone/core/AutoRaid';
import {LegacyMapper} from './LegacyMapper';
import {Scanner} from '../standalone/core/Scanner';
import {CoordinateType} from '../common/types';
import {EspionageRepository} from '../standalone/repository/EspionageRepository';
import {GalaxyRepository} from '../standalone/repository/GalaxyRepository';

const app = express();
const port = 8080;

const autoRaid = new AutoRaid(LegacyMapper.instance);
const scanner = new Scanner(LegacyMapper.instance);
const analyzer = new Analyzer(LegacyMapper.instance)

// TODO init (and inject?) all components
app.use(express.static(path.join(__dirname, 'public')));
app.set('json replacer', function (this: any, key: string, value: any) {
  if (this[key] instanceof Date) // direct test on value doesn't work
    return this[key].getTime();
  return value;
});

app.all('/*', useCookiesIfPresent, addCORSHeader);

app.get('/login', (req, res, next) => {
  LegacyMapper.instance.loginLobby().then(result => {
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
    let cookies: Cookie[] = LegacyMapper.instance.requestJar.getCookies(String(req.query['url']));
    if ('relay' in req.query) {
      let relayCode = cookies.map(c => `document.cookie="${[`${c.key}=${c.value}`, `path=${c.path}`].join('; ')}";`).join('\n');
      res.send(relayCode);
    } else {
      res.json({cookies});
    }
  } else
    res.json(LegacyMapper.instance.jar);
});

app.get('/ping', (req, res, next) => {
  LegacyMapper.instance.ping().then(response => {
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
      LegacyMapper.instance.observe.galaxyMin = Math.min(...galaxy);
      LegacyMapper.instance.observe.galaxyMax = Math.max(...galaxy);
    }
  }
  if (systemParams) {
    let system = systemParams.map(x => ~~(+x)).filter(x => x >= 1 && x <= 499);
    if (system.length) {
      LegacyMapper.instance.observe.systemMin = Math.min(...system);
      LegacyMapper.instance.observe.systemMax = Math.max(...system);
    }
  }

  if ('pause' in req.query) {
    LegacyMapper.instance.observe.pause = true;
  } else if ('continue' in req.query) {
    LegacyMapper.instance.observe.pause = false;
    LegacyMapper.instance.continueObserve();
  }

  res.json(LegacyMapper.instance.observe);
});


app.get('/raid', (req, res) => {
  if ('slots' in req.query)
    autoRaid.state.maxSlots = +req.query['slots']!;
  if ('continue' in req.query) {
    autoRaid.continue();
    res.status(202);
  }
  res.json(autoRaid.state);
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
    let value: any = (LegacyMapper.instance as any)[field[0]];
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
    LegacyMapper.instance.loadAllReports();
  res.json(LegacyMapper.instance.reportIdList);
});

app.get('/scan', (req, res) => {
  if ('load' in req.query)
    GalaxyRepository.instance.findInactiveTargets().then(
        targets => scanner.targets = targets);
  else if ('continue' in req.query) {
    scanner.launchNext()
  }
  res.json(scanner);
});

app.get('/analyze', (req, res) => {
  if ('load' in req.query)
    analyzer.load();
  else if ('scan' in req.query)
    analyzer.scan(+req.query['scan']!);
  else if ('launch' in req.query)
    analyzer.launch(+req.query['launch']!);

  res.json(analyzer.reports);
});

app.get('/events', (req, res) => {
  LegacyMapper.instance.loadEvents().then(events => res.json(events));
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
      LegacyMapper.instance.useCookie(mergedCookies, (req.params['url'] || req.query['url'] || req.headers.referer) as string);
  }
  next();
}

function addCORSHeader(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('access-control-allow-origin', `https://${LegacyMapper.GAME_DOMAIN}`);
  next();
}
