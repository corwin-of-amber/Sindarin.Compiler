import React from "react";

export default class Resizer extends React.Component<{}, {}> {
  ref: any;
  leftRef: any;
  rightRef: any;
  active: boolean;
  leftWidth: number;
  rightWidth: number;

  constructor(props: {}) {
    super(props);
    this.ref = React.createRef();
    this.leftRef = null;
    this.rightRef = null;
    this.active = false;
    this.leftWidth = 0;
    this.rightWidth = 0;

    this.onMouseMove = this.onMouseMove.bind(this);
  }

  private getWidth(el: HTMLElement) {
    return Number(
      window
        .getComputedStyle(el)
        .getPropertyValue("width")
        .replace(/[^0-9.]/g, "")
    );
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.active) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.leftRef) {
      this.leftWidth += event.movementX;
    } else {
      if (this.ref.current) {
        const el = this.ref.current.previousElementSibling;
        if (el.classList.contains("panel")) {
          this.leftRef = el;
          this.leftWidth = this.getWidth(el);
        }
      }
    }

    if (this.rightRef) {
      this.rightWidth -= event.movementX;
    } else {
      if (this.ref.current) {
        const el = this.ref.current.nextElementSibling;
        if (el.classList.contains("panel")) {
          this.rightRef = el;
          this.rightWidth = this.getWidth(el);
        }
      }
    }

    if (this.leftRef && this.leftWidth > 0) {
      this.leftRef.style.width = this.leftWidth + "px";
    }
    if (this.rightRef && this.rightWidth > 0) {
      this.rightRef.style.width = this.rightWidth + "px";
    }
  }

  shouldComponentUpdate(): boolean {
    return false;
  }

  componentDidMount(): void {
    document.addEventListener("mouseup", () => {
      this.active = false;
    });
    document.addEventListener("mouseleave", () => {
      this.ref.current.style.cursor = "default";
    });
    document.addEventListener("mousemove", this.onMouseMove);
  }

  render(): JSX.Element {
    return (
      <div
        className="resizer"
        ref={this.ref}
        onMouseOver={() => {
          this.ref.current.style.cursor = "col-resize";
        }}
        onMouseDown={() => {
          this.active = true;
          this.ref.current.style.cursor = "col-resize";
        }}
      />
    );
  }
}
