const path = require('path');
const fs   = require('fs');

const git  = require('simple-git');
const Infra     = require('../infra/infrastructure');

// Handles reading and processing setup block of stepfile
class Setup {

    async setup(doc, stepFile)
    {
        let provider = Object.keys(doc.setup)[0];
        let cwd = provider === 'local' ? path.join(process.cwd(), path.dirname(stepFile), 'docable_results') : '.';

        let docPath;
        if( Object.keys(doc.setup).includes('git') )
        {
            console.log(`Cloning or pulling: ${doc.setup.git}`);
            docPath = await this.cloneOrPull( doc.setup.git, path.dirname(stepFile) );
            cwd = docPath;
        } else {
            docPath = path.dirname(stepFile);
        }

        let conn = await Infra.select( doc, provider, path.dirname(stepFile))

        return {conn:conn,cwd:cwd, docPath:docPath};
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
}

module.exports = Setup;
