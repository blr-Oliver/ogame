import {SimpleHandleFunction} from 'connect';
import {createServer, Options} from 'http-server';

const COMMON_OPTIONS: Options = {
  cache: -1,
  showDir: true,
  autoIndex: false,
  showDotfiles: false,
  gzip: true,
  cors: true,
  corsHeaders: 'Service-Worker'
};

export function createHttpToFsHandler(root: string, options?: Options): SimpleHandleFunction {
  if (options)
    options.root = root;
  else
    options = {root};
  let dummy = createServer({
    ...COMMON_OPTIONS,
    ...options
  });
  return (dummy as any).server._events['request'] as SimpleHandleFunction;
}

export function reroute(inSegment: string, outSegment: string, srcHandler: SimpleHandleFunction): SimpleHandleFunction {
  return (req, res) => {
    req.url = req.url!.replace(inSegment, outSegment);
    srcHandler(req, res);
  }
}
