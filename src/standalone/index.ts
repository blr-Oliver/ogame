import * as express from 'express';
import * as fs from 'fs';
import {CoordinateType, SystemCoordinates} from 'ogame-core';
import * as path from 'path';
import {Cookie} from 'tough-cookie';
import {autoObserve, espionageRepo, espionageReportScrapper, fetcher, galaxyRepo, mapper, serverContext, universeContext} from './init-components';

const app = express();
const port = 8080;

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
  galaxyRepo.loadSystem(+req.params['galaxy'], +req.params['system']).then(systemInfo => {
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
    let cookies: Cookie[] = fetcher.requestJar.getCookies(String(req.query['url']));
    if ('relay' in req.query) {
      let relayCode = cookies.map(c => `document.cookie="${[`${c.key}=${c.value}`, `path=${c.path}`].join('; ')}";`).join('\n');
      res.send(relayCode);
    } else {
      res.json({cookies});
    }
  } else
    res.json(fetcher.jar);
});

app.get('/ping', (req, res, next) => {
  mapper.ping().then(response => {
    let statusCode = response.status;
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
  const settings = autoObserve.settings;
  if (galaxyParams && systemParams) {
    let galaxy = galaxyParams.map(x => ~~(+x)).filter(x => x >= 1 && x <= universeContext.maxGalaxy);
    let system = systemParams.map(x => ~~(+x)).filter(x => x >= 1 && x <= universeContext.maxSystem);
    let coords: SystemCoordinates[] = []
    while (galaxy.length && system.length)
      coords.push([galaxy.shift()!, system.shift()!]);
    autoObserve.enqueue(...coords);
  }
  if ('delay' in req.query) {
    settings.delay = +req.query['delay']!;
  }
  if ('pause' in req.query) {
    autoObserve.pause()
  } else if ('continue' in req.query) {
    autoObserve.continue();
  }

  res.json(settings);
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
      fetcher.useCookie(mergedCookies, (req.params['url'] || req.query['url'] || req.headers.referer) as string);
  }
  next();
}

function addCORSHeader(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('access-control-allow-origin', `https://${serverContext.domain}`);
  next();
}
