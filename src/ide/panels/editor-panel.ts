
import Vue from 'vue';
import Component from 'vue-class-component';

import CodeMirror from 'codemirror';
import 'codemirror/mode/clike/clike';
import 'codemirror/lib/codemirror.css';



@Component
class EditorPanel extends Vue {

    $el: HTMLDivElement
    editor: CodeMirror.Editor

    render(createElement) {
        return createElement('div');
    }

    mounted() {
        this.editor = CodeMirror(this.$el, {
            lineNumbers: true
        });
    }    

    async open(uri: string | File) {
        var r = typeof uri === 'string' ? await fetch(uri) : uri;
        this.editor.swapDoc(new CodeMirror.Doc(await r.text(), 'text/x-c'));
    }

    static install() {
        Vue.component('ide-panel-editor', this);
    }

}



type CodePosition = {doc: CodeMirror.Doc, line: number, col: number};

class CodeRange {
    from: CodePosition
    to: CodePosition
    _mark: CodeMirror.TextMarker

    constructor(from: CodePosition, to: CodePosition) {
        this.from = from; this.to = to;
    }
    highlight() {
        return this._mark = this.from.doc.markText(
            {line: this.from.line - 1, ch: this.from.col - 1},
            {line: this.to.line - 1, ch: this.to.col - 1},
            {className: 'highlight'}
        );
    }
    unhighlight() {
        if (this._mark) {
            this._mark.clear();
            this._mark = undefined;
        }
    }
}


export { EditorPanel, CodePosition, CodeRange }
