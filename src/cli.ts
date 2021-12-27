import fs from "fs";
import path from "path";
import mkdirp from "mkdirp";
import { C99Parser } from "./syntax/c99";

import commander from "commander";
import manifest from "../package.json";

class CLI {
  rc = 0;

  async main() {
    var prog = new commander.Command()
      .name("sindarin.compiler")
      .version(manifest.version);
    prog
      .command("parse [filenames...]", { isDefault: true })
      .option("-o <FILE>")
      .option("--out-dir <DIR>")
      .action((...a) => this.parse(...a));

    await prog.parseAsync(process.argv);
    return this.rc;
  }

  async parse(filenames?: string[], opts?: { o?: string; outDir?: string }) {
    var parser = new C99Parser();
    for (let infn of filenames) {
      try {
        var text = fs.readFileSync(infn, "utf-8");
      } catch (e) {
        console.error(`cannot read ${infn}: ${e}`);
        this.rc = 1;
        continue;
      }
      var outfn = opts.o ?? infn + ".ast.json";
      if (opts.outDir) outfn = path.join(opts.outDir, path.basename(outfn));
      try {
        var ast = parser.parse(text);
      } catch (e) {
        console.error(`in ${infn}:\n${e}`);
        this.rc = 1;
        continue;
      }

      var out = JSON.stringify(ast, null, 1);

      if (outfn == "-") {
        await new Promise((resolve) => process.stdout.write(out, resolve));
      } else {
        console.log(`${infn}  -->  ${outfn}`);
        mkdirp.sync(path.dirname(outfn));
        fs.writeFileSync(outfn, out);
      }
    }
  }
}

new CLI().main().then((rc) => process.exit(rc));
