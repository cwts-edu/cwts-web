export default class {
    constructor(private target: Element | null, private className: string) {
    }

    public toggle() {
        this.target?.classList.toggle(this.className);
    }

    public off() {
        this.target?.classList.remove(this.className);
    }

    public on() {
        this.target?.classList.add(this.className);
    }

    public attachToggler(toggler: Element | null, event: string = "click") {
        toggler?.addEventListener(event, () => {this.toggle()});
    }

    public attachCloser(closer: Element | null, event: string = "click") {
        closer?.addEventListener(event, () => {this.off()});
    }

    public attachTrigger(trigger: Element | null,  event: string = "click") {
        trigger?.addEventListener(event, () => {this.on()});
    }
};