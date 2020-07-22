const path = require('path');
const fs   = require('fs');
const yaml = require('js-yaml');
const git  = require('simple-git');
const Connector = require('infra.connectors');

const Infra     = require('../infra/infrastructure');

// Handles reading and processing setup block of stepfile
class Setup {

    /**
     * Setup the env needed for execution
     * @param {String} doc path to steps.yml to inline md file
     * @param {String} html path to html, if doc is steps.yml
     */
    async setup(doc, html) {
        let configString;

        // if step
        if (this.html) {
            configString = await fs.promises.readFile(html);
        }

        // if inline
        else if (this.doc) {
            const $ = cheerio.load(await fs.promises.readFile(this.doc, { encoding: 'utf-8' }));
            configString = $.root().contents().filter(function () { return this.type == 'comment'; }).get(0).data;
        }

        // if any setup config specified
        if(configString && configString.trim() != '') {

            const setupObj = yaml.safeLoad(configString).setup;

            const provider = Object.keys(setupObj)[0];
            let cwd = provider === 'local' ? path.join(process.cwd(), path.dirname(doc), 'docable_results') : '.';
    
            let docPath = path.dirname(doc);
    
            // If using git repo, clone repo and update cwd/docPath
            if (Object.keys(setupObj).includes('git')) {
                console.log(`Cloning or pulling: ${setupObj.git}`);
                docPath = await this.cloneOrPull(setupObj.git, path.dirname(doc));
                cwd = docPath;
            }
    
            // If using targets
            let targets = {};
            if (Object.keys(setupObj).includes('targets')) {
                targets = await this.createTargetConnections(setupObj.targets, cwd);
            }
    
            // clean stanza
            let clean;
            if (Object.keys(setupObj).includes('clean')) {
                clean = setupObj.clean;
            }
    
            // let verify;
            if (Object.keys(setupObj).includes('verify')) {
                verify = setupObj.verify;
            }
    
            let conn = await Infra.select( setupObj, provider, cwd)
    
            return {conn, cwd, docPath, targets, clean, verify};
        }

        // use local connector if no setup configuration specified
        else {
            const conn = Connector.getConnector('local');
            return {conn, cwd: '.'};
        }

    }

    async cloneOrPull(repoURL, dest) {
        let name = path.basename(repoURL);
        name = name.slice(-4) === '.git' ? name.slice(0, -4) : name; // Removing .git from the end
        let repo_dir = path.join(dest, name);

        return new Promise((resolve, reject) => {

            // Run git pull if repo already exists locally
            if( fs.existsSync(repo_dir) )
            {
                git(repo_dir).pull( (err, data) =>
                {
                    if (err)
                        reject(err);
                    else
                        resolve(repo_dir);
                })
            }
            else // clone
            {
               git(dest).silent(true).clone(repoURL, (err, data) => {
                    if (err)
                        reject(err);
                    else
                        resolve(repo_dir);
                });
            }
        });
    }

    // async createTargetConnections(targets, cwd)
    // {
    //     let targetsDict = {};
    //     for ( let target of targets )
    //     {
    //         let provider = Object.keys(target)[0];
    //         switch( provider )
    //         {
    //             case 'baker':
    //                 let bakerPath = target[provider];
    //                 let realPath = path.join(cwd, bakerPath);
    //                 let connector = Connector.getConnector('baker', realPath, {});
    //                 let name = await connector.getName();
    //                 targetsDict[name] = connector;
    //                 break;
    //             case 'ssh':
    //                 let sshObject = target[provider];
    //                 let conn = Connector.getConnector('ssh', 
    //                     sshObject.host, {privateKey: this.resolvePath(sshObject.privateKey)});
    //                 targetsDict[sshObject.name] = conn;
    //                 break;
    //             default:
    //                 throw new Error(`Unsupported provider: ${provider}`);   
    //         }    
    //     }
    //     return targetsDict;
    // }

    // resolvePath(destPath) {
    //     if (!destPath) return destPath;
    //     if (destPath.slice(0, 2) !== '~/') return path.resolve(destPath);
    //     return path.resolve(path.join(os.homedir(), destPath.slice(2)));
    // }
}

module.exports = Setup;
