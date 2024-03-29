const path = require('path');
const cheerio = require('cheerio');
const Connector = require('infra.connectors');
const chalk  = require('chalk');
const slash = require('slash');
const fs = require('fs');

const transformers = require('../transformers');
const Setup = require('./setup');
const Operators = require('../infra/operators');
const Infra     = require('../infra/infrastructure');

const yaml = require('js-yaml');
const mustache = require('mustache');
var events = require('events');

class Stepper {

    constructor(doc, html) {
        this.doc = doc;
        this.html = html;

        // For clients to listen to step progress
        this.progress = new events.EventEmitter();
    }

    async setup(setupObj) {
        const setup = new Setup();
        const { conn, cwd, html, docPath, targets, clean, verify } = await setup.setup(this.doc, this.html, setupObj);
        this.html = html;

        this.cwd = cwd;
        this.conn = conn;
    }

    async buildConnector(setupObj, cwd, docDir) {
        let connectors = [];

        for (let target of setupObj.targets) {
            connectors.push({ name: target.slug || target.name, cwd: target.cwd, connector: async () => await Infra.select(target, target.cwd || cwd, docDir) });
        }

        this.docDir = docDir;

        return connectors;
    }

    async getSetupFromDocument(doc) {
        const setup = new Setup();
        let setupString = await setup.extractSetup(doc);
        return yaml.safeLoad(setupString);
    }

    /**
     * Run current stepper obj's cells and return $ + results obj:
     * [
     *   {cell : {content, path, user, persistent, etc}, result: {status, exitCode, stdout, stderr}},
     *   ...
     * ]
     * 
     * @param {Number} stepIndex index of the cell to execute
     * @param {String} IR optionally pass IR for the execution.
     */
    async run(stepIndex, IR) {
        let { cells, $ } = await this._parse(IR);

        let connector = this.conn || Connector.getConnector('local');
        let cwd = this.cwd || '.';

        return this.runSteps(cells, $, connector, cwd, stepIndex );
    }

    async runSteps(cells, $, connectors, cwd, stepIndex, vars, stdioStreams) {
        let results = [];
        let status = true;

        // only run the specified index if specified
        if (stepIndex != undefined) cells = [cells[stepIndex]];

        // Disable html escaping! We want literal values!
        mustache.escape = function (value)
        {
            return value;
        };

        for (const cell of cells) {

            const cellTargetConnector = connectors.filter(conn => conn.name == cell.target)[0] || connectors[0];
            const cellTargetConnectorInstance = await cellTargetConnector.connector();
            const op = new Operators(cellTargetConnectorInstance, cellTargetConnector.cwd);

            if (cell.variables) {
                const variables = cell.variables.split(',').map(v => v.trim());
                for (const variable of variables) {
                    if (vars[variable] == undefined) 
                        throw Error(`Error: "${variable}" variable is not provided.`);
                }
                cell.content = mustache.render(cell.content, vars);
            }

            let result;
            let cleanUp;
            switch (cell.type) {

                case 'copy':
                    // This is set in buildConnector when called through fromHtml.
                    let cwd = this.docDir || process.cwd;
                    result = await op.copy(cell, cwd);
                    break;
                case 'file':
                    result = await op.file(cell.content, cell.path, cell.user, undefined, cell.permission, cell.mode);
                    break;
                case 'script':
                {
                    const uniqueId = cell.elem.attribs.id.split('-').slice(-1)[0];
                    const cwd = cellTargetConnector.cwd
                    
                    if (cell.lang === "js") {
                        // const contentWrapedInAsync = `(async () => {\n${cell.content}\n})();`;
                        const contentWrapedInAsync = cell.content;
                        let scriptPath = cell.path || slash(path.join(cwd, `${uniqueId}-docable.js`));
                        await op.file(contentWrapedInAsync, scriptPath, cell.user, undefined, cell.permission, cell.mode);

                        let runnerScript = 
                        `
                        const child_process = require('child_process');
                        const path = require('path')
                        const fs = require('fs');

                        const scriptPath = '${scriptPath.replace(/\\/g, '\\\\')}';
                        const ScriptSrc = fs.readFileSync(scriptPath, {encoding: 'utf-8'});
                        const mList = [...ScriptSrc.matchAll(/(?:require\\s*\\(\\s*(?:'|"))(.*?)(?:(?:'|")\\s*\\))/g)].map(m => m[1]);

                        const unsatisfiedDeps = mList.filter(m => {
                                                         try { require.resolve(m); }
                                                         catch (err) { return true; }
                                                     });
                        if(unsatisfiedDeps.length > 0)
                            child_process.spawnSync(\`npm install \${unsatisfiedDeps.join(' ')}\`, {cwd: path.dirname(scriptPath), shell: true, stdio: 'ignore'});
                        `;

                        // let scriptRunnerPath = await cellTargetConnectorInstance.writeTempFile("docable-script-runner.js", runnerScript);

                        //cell.content = `node "${scriptRunnerPath}" && node "${scriptPath}" `;
                        cell.content = `node "${scriptPath}"`;
                        cleanUp = scriptPath;
                    }

                    if (cell.lang === "python") {
                        let scriptPath = cell.path || slash(path.join(cwd, `${uniqueId}-docable.python`));
                        await op.file(cell.content, scriptPath, cell.user, undefined, cell.permission, cell.mode);

                        cell.content = `python "${scriptPath}"`;
                        cleanUp = scriptPath;
                    }

                    if (cell.lang === "ruby") {
                        let scriptPath = cell.path || slash(path.join(cwd, `${uniqueId}-docable.rb`));
                        await op.file(cell.content, scriptPath, cell.user, undefined, cell.permission, cell.mode);

                        cell.content = `ruby "${scriptPath}"`;
                        cleanUp = scriptPath;
                    }

                    if (cell.lang === "java") {
                        // basic patching if no class / main method
                        if (!cell.content.includes('class')) {
                            cell.content =
                            `
                            public class Docable {
                                public static void main(String[] args) { 
                                    ${cell.content}
                                }
                            }
                            `;
                        }
                        let scriptPath = cell.path || slash(path.join(cwd, `${uniqueId}-docable.java`));
                        await op.file(cell.content, scriptPath, cell.user, undefined, cell.permission, cell.mode);

                        cell.content = `java "${scriptPath}"`;
                        cleanUp = scriptPath;
                    }

                    if (cell.lang === 'bash') {
                        let scriptPath = cell.path || slash(path.join(cwd, `${uniqueId}-docable.sh`));
                        await op.file(cell.content, scriptPath, cell.user, undefined, cell.permission, cell.mode);

                        cell.content = `bash "${scriptPath}"`;
                        cleanUp = scriptPath;
                    }

                    /* intentional fall-through */ 
                }
                case 'command':
                    let onProgress;
                    if( cell.stream || cell.serve )
                    {
                        let self = this;
                        onProgress = function(data) {
                            self.progress.emit('data', data);
                        };                        
                    }
                    result = await op.run(cell, onProgress, undefined, stdioStreams);
                    break;
                case 'edit':
                    result = await op.edit(cell.content, cell.path, cell.user);
                default:
                    break;
            }

            if(cell.failedWhen)
                result.status = !eval(cell.failedWhen
                                        .replace('exitCode', 'result.exitCode')
                                        .replace('stderr', 'result.stderr')
                                        .replace('stdout', 'result.stdout'));

            else
                result.status = result.exitCode == 0 && result.stderr === "";

            let execLog = `${JSON.stringify({ ...result, status: undefined }, null, 2)}`;

            const printColor = result.status ? 'green' : 'red';
            if (!Boolean(result.stderr)) {
                console.log(chalk`{${printColor} ${execLog}}`);
            }
            else {
                console.error(chalk`{${printColor} ${execLog}}`); // Write to stderr
            }

            results.push({
                cell,
                result
            });

            status = status && result.status;

            // Clean up any local tmpfiles
            if (cleanUp && cellTargetConnectorInstance.type == "local") {
                try { fs.promises.unlink(cleanUp); }
                catch (e) { console.log(e); }
            }
        }
        
        return { results, $, status };
    }

    async _parse(IR) {
        if(!IR) {
            if (this.doc && this.html)
                IR = await transformers.step.transform(this.doc, this.html);
            else
                IR = await transformers.inline.transform(this.doc);
        }

        let cells = [];

        const $ = cheerio.load(IR);
        $('[data-docable="true"]').each(function (index, elem) {
            cells.push({
                index,
                content: $(elem).text().trim(),
                ...$(elem).data(),
                elem
            });
        });

        return { cells, $ };
    }

}

module.exports = Stepper;
