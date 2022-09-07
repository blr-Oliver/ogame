import {BufferedStringSource, Document, UTF8NonValidatingCharacterSource, XML} from 'my-xml-lite';
import {ResponseFacade} from '../../core/Fetcher';

export class XmlLiteResponseParser {
  private readonly charSource: UTF8NonValidatingCharacterSource;
  private readonly stringSource: BufferedStringSource;

  constructor() {
    this.charSource = new UTF8NonValidatingCharacterSource();
    this.stringSource = new BufferedStringSource(this.charSource, 1 << 16);
  }

  async parseResponse(response: ResponseFacade): Promise<Document> {
    const buffer = await response.arrayBuffer();
    this.charSource.setData(new Uint8Array(buffer));
    this.stringSource.reset();
    return XML.parse(this.stringSource);
  }
}