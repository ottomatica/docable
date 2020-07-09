const chalk = require('chalk');
const path  = require('path');
const os    = require('os');
const hostUsername = os.userInfo().username;
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class Operators {
    constructor(connector, cwd, targets)
    {
        this.connector = connector;
        this.cwd = cwd;
        connector.setCWD(cwd);
        this.spawnedPids = [];
        this.targets = targets;
    }

    async sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

    getConnector(name)
    {
        if( name && Object.keys(this.targets).includes(name) )
        {
            console.log(`Retrieving target ${name}`);
            return this.targets[name];            
        }
        return this.connector;
    }

    // Place content as file
    async file(content, location, user, target, permission) {
        console.log(chalk`{blue placing contents in file:} {rgb(173,216,230) ${location}}\n${content.substring(0, 50)}...`);

        let output;
        const conn = this.getConnector(target);

        const tempPath = path.join(os.tmpdir(), uuidv4());

        try {
            await fs.promises.writeFile(tempPath, content);
            await conn.scp(tempPath, `/tmp/${path.basename(location)}`);
            output = await conn.exec(`${this.sudoCMD(user, conn)} mv /tmp/${path.basename(location)} ${location}`);

            if (permission) {
                output = await conn.exec(`${this.sudoCMD(user, conn)} chmod +${permission} ${location}`);
            }
        }
        catch (err) {
            output = { stdout: '', stderr: err, exitCode: 1 }
        }

        await fs.promises.unlink(tempPath);

        if (output.exitCode != 0) {
            throw (output.stderr);
        }
        return output;
    }

    // Long running command...
    // TODO: add spawnPersistent?
    async running(cmd, user, persistent, target)
    {
        let conn = this.getConnector(target);

        console.log(chalk`{rgb(255,136,0) running background command...}\n${cmd}`);
        let results = await conn.spawn(`${this.sudoCMD(user, conn)} ${cmd}`, {cwd: this.cwd});
        if( results.pid )
        {
            console.log( `Spawned pid: ${results.pid}`);
            this.spawnedPids.push( results.pid );
        }
        // // Need time to let background commands be ready for follow-on commands.
        await this.sleep(500);
    }

    // Simple command
    async run(cmd, user, persistent, target)
    {
        let conn = this.getConnector(target);

        console.log(chalk`{green running...}\n${cmd}`);
        let output;

        if (persistent) output = await conn.execPersistent(`${this.sudoCMD(user, conn)} ` + cmd, persistent);
        else output = await conn.exec(`${this.sudoCMD(user, conn)} ` + cmd);

        return output;
    }

    // TODO need to associate pids with targets/connector.
    async tearDown(targets)
    {
        //let conn = this.getConnector(targets);
        if( this.spawnedPids.length > 0 )
        {
            console.log(chalk`{rgb(255,136,0) Tearing down background commands with pids: ${this.spawnedPids.join(',')}}`);
            for( let pid of this.spawnedPids )
            {
                await this.connector.exec(`kill -9 ${pid}`);
            }
        }
    }

    sudoCMD(user, conn) {

        if (user) // && conn.sshConfig && conn.sshConfig.user != user)
            return `sudo -u ${user}`;
        else
            return '';
    }
}

module.exports = Operators;
