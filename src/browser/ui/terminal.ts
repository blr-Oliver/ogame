export class Terminal {
  private isVisible: boolean = false;
  private element: HTMLElement;

  constructor() {
    this.element = this.init();
  }

  private init(): HTMLElement {
    document.addEventListener('keypress', event => {
      if (event.key === '`') this.toggle();
    });
    let fragment = document.createDocumentFragment();
    let element = document.createElement('div');
    element.id = 'terminal';
    Object.assign(element.style, {
      position: 'fixed',
      width: '100%',
      height: '30%',
      left: '0',
      bottom: '0',
      display: 'none',
      backgroundColor: 'white',
      zIndex: '100'
    });
    return document.body.appendChild(element);
  }
  public get visible(): boolean {
    return this.isVisible;
  }

  public set visible(value: boolean) {
    if (this.isVisible != value) {
      this.isVisible = value;
      if (this.isVisible) {
        this.show()
      } else {
        this.hide();
      }
    }
  }

  show() {
    this.isVisible = true;
    this.element.style.display = 'block';
  }

  hide() {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  toggle() {
    this.visible = !this.visible;
  }
}

export const terminal: Terminal = new Terminal();

