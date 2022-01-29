import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {Cookie} from 'tough-cookie';
import {Analyzer} from '../common/core/Analyzer';
import {AutoRaid} from '../common/core/AutoRaid';
import {Scanner} from '../common/core/Scanner';
import {CoordinateType} from '../common/types';
import {SqlEspionageRepository} from '../standalone/repository/SqlEspionageRepository';
import {SqlGalaxyRepository} from '../standalone/repository/SqlGalaxyRepository';
import {StaticGameContext} from '../standalone/StaticGameContext';
import {EspionageReportScrapper} from './EspionageReportScrapper';
import {GalaxyObserver} from './GalaxyObserver';
import {LegacyFetcher} from './legacy-fetcher';
import {LegacyMapper} from './LegacyMapper';

const app = express();
const port = 8080;

const gameContext = new StaticGameContext();
const espionageRepo = new SqlEspionageRepository();
const galaxyRepo = new SqlGalaxyRepository();
const fetcher = new LegacyFetcher();
const espionageReportScrapper = new EspionageReportScrapper(espionageRepo, fetcher);
const galaxyObserver = new GalaxyObserver(galaxyRepo, fetcher);
const mapper = new LegacyMapper(galaxyRepo, fetcher);
const scanner = new Scanner(gameContext, mapper);
const autoRaid = new AutoRaid(gameContext, mapper, espionageRepo, galaxyRepo);
const analyzer = new Analyzer(gameContext, mapper, espionageRepo, galaxyRepo);

// TODO init (and inject?) all components
app.use(express.static(path.join(__dirname, 'public')));
app.set('json replacer', function (this: any, key: string, value: any) {
  if (this[key] instanceof Date) // direct test on value doesn't work
    return this[key].getTime();
  return value;
});

app.all('/*', useCookiesIfPresent, addCORSHeader);

app.get('/login', (req, res, next) => {
  mapper.loginLobby().then(result => {
    res.send(result);
  }).then(next);
});

app.get('/display/galaxy/:galaxy/:system', (req, res) => {
  galaxyRepo.load(+req.params['galaxy'], +req.params['system']).then(systemInfo => {
    res.json(systemInfo);
  });
});

app.get('/display/report/:galaxy/:system/:position/:type?', (req, res) => {
  let type: CoordinateType = +(req.params['type'] || CoordinateType.Planet);
  espionageRepo.load(+req.params['galaxy'], +req.params['system'], +req.params['position'], type).then(report => {
    res.json(report);
  });
});

app.get('/cookies', (req, res) => {
  if ('url' in req.query) {
    let cookies: Cookie[] = mapper.requestJar.getCookies(String(req.query['url']));
    if ('relay' in req.query) {
      let relayCode = cookies.map(c => `document.cookie="${[`${c.key}=${c.value}`, `path=${c.path}`].join('; ')}";`).join('\n');
      res.send(relayCode);
    } else {
      res.json({cookies});
    }
  } else
    res.json(mapper.jar);
});

app.get('/ping', (req, res, next) => {
  mapper.ping().then(response => {
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
      galaxyObserver.observe.galaxyMin = Math.min(...galaxy);
      galaxyObserver.observe.galaxyMax = Math.max(...galaxy);
    }
  }
  if (systemParams) {
    let system = systemParams.map(x => ~~(+x)).filter(x => x >= 1 && x <= 499);
    if (system.length) {
      galaxyObserver.observe.systemMin = Math.min(...system);
      galaxyObserver.observe.systemMax = Math.max(...system);
    }
  }

  if ('pause' in req.query) {
    galaxyObserver.observe.pause = true;
  } else if ('continue' in req.query) {
    galaxyObserver.observe.pause = false;
    galaxyObserver.continueObserve();
  }

  res.json(galaxyObserver.observe);
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
    let value: any = (mapper as any)[field[0]];
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
    espionageReportScrapper.loadAllReports();
  res.json(espionageReportScrapper.loadingQueue);
});

app.get('/scan', (req, res) => {
  if ('load' in req.query)
    galaxyRepo.findInactiveTargets().then(
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
  mapper.loadEvents().then(events => res.json(events));
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
      mapper.useCookie(mergedCookies, (req.params['url'] || req.query['url'] || req.headers.referer) as string);
  }
  next();
}

function addCORSHeader(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('access-control-allow-origin', `https://${LegacyMapper.GAME_DOMAIN}`);
  next();
}
