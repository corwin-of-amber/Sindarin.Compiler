import Vue from 'vue';

import { Hypergraph } from '../analysis/hypergraph';

// @ts-ignore
import ide from './ide.vue';
import './ide.css';
import { EditorPanel } from './panels/editor-panel';
import { AstPanel, Ast } from './panels/ast-panel';
import { PegPanel } from './panels/peg-panel';



class IDE {

    vue: Vue
    panels: {editor: EditorPanel, ast: AstPanel, peg: PegPanel}

    parser: Parser

    constructor() {
        this.vue = new Vue(ide);
        this.vue.$props.panels = [
            {id: 'editor', _component: 'ide-panel-editor'},
            {id: 'ast', _component: 'ide-panel-ast'},
            {id: 'peg', _component: 'ide-panel-peg'}
        ];
        this.vue.$props.messages = [];
        this.vue.$mount(document.querySelector('#ide'));
        this.vue.$on('file-open', (fl: File) => this.open(fl));
        this.panels = {
            editor: this.vue.$refs.editor[0],
            ast: this.vue.$refs.ast[0],
            peg: this.vue.$refs.peg[0]
        };
        this.panels.ast.$on('action:peg', (ev: {ast: Ast}) => {
            this.panels.peg.show(new Hypergraph().fromAst(ev.ast));
        });
        this.setupGlobalKeys();
    }

    async open(uri: string | File) {
        await this.panels.editor.open(uri);
        this.panels.ast.generation = undefined;
        if (this.parser) this.reparse();
    }

    parse(parser: Parser = this.parser) {
        this.reportClear();
        this.parser = parser;
        var doc = this.panels.editor.editor.getDoc();
        try {
            this.panels.ast.parse(doc, parser);
        }
        catch (e) {
            this.report('' + e, 'error');
            throw e;
        }
    }

    /**
     * Runs `parse` again only if the document was changed.
     */
    reparse(parser: Parser = this.parser) {
        if (this.panels.ast.generation !== undefined) {
            var doc = this.panels.editor.editor.getDoc();
            if (doc.isClean(this.panels.ast.generation)) return;
        }
        this.parse(parser);
    }

    reportClear() {
        this.vue.$props.messages = [];
    }

    report(text: string, kind = 'info') {
        this.vue.$props.messages.push({text, kind});
    }

    setupGlobalKeys() {
        document.addEventListener( 'keydown', (ev) => {
            if ((ev.key == "Enter" || ev.key == "s")
                 && (ev.ctrlKey || ev.metaKey)) {
                ev.stopPropagation(); ev.preventDefault();
                try { this.reparse(); } catch { }
            }
        }, {capture: true})
    }
}

interface Parser {
    parse(program: string): Ast;
}


EditorPanel.install();
AstPanel.install();
PegPanel.install();



export { IDE, Parser }