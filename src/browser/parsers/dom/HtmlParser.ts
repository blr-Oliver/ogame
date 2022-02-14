export interface HtmlParser {
  parse(body: string): Document | DocumentFragment;
}

export class NavigatorHtmlParser implements HtmlParser {
  private readonly domParser: DOMParser;

  constructor(domParser?: DOMParser) {
    this.domParser = domParser || new DOMParser();
  }
  parse(body: string): Document {
    return this.domParser.parseFromString(body, 'text/html');
  }
}
