const path = require('path');
const os = require('os');
const Connector = require('infra.connectors');

class Infra {
    constructor() { }

    static async select(target, cwd, docDir) {
        let opts = {};
        let name;
        if (target.type === 'slim') {
            // choose slim provider (ie vbox, kvm, etc)
            opts['provider'] = target.provider || undefined;
            name = `${path.basename(cwd)}-docable-vm`;
        }

        if (target.type === 'ssh') {
            name = target.host;

            opts.privateKey = target.privateKey;
            if (opts.privateKey.startsWith('~/')) opts.privateKey = opts.privateKey.replace('~/', os.homedir() + '/');
            opts.privateKey = path.isAbsolute(opts.privateKey) ?
                target.privateKey : path.resolve(docDir, target.privateKey);
        }

        if (target.type === 'bakerx') {
            name = target.name;
        }

        if (target.type === 'docker') {
            name = target.name;
            opts = target.options;
        }

        let conn = Connector.getConnector(target.type, name, opts);
        switch (target.type) {
            case 'slim':
            {
                let image = target.image;

                if( await conn.getState(name).catch(() => false) === "running" ) { break; }
                if( !await conn.isImageAvailable(image) )
                {
                    console.log("Preparing slim one-time build")
                    await conn.build( path.join( cwd, image ));
                }
                await conn.delete(name);

                // passthrough options in setup directly.
                let options = target;
                await conn.provision( name, image, options );
                // wait for port to be forwarded
                // await new Promise(resolve => setTimeout(resolve, 10000));
                console.log('Waiting for VM to be ready');
                let status = await conn.ready();
                //console.log(`Infrastructure status is ready: ${status}`);

                break;
            }
            case 'local':
            {
                break;
            }
            case 'ssh':
            {
                break;
            }
            case 'bakerx':
            {
                break;
            }
            case 'docker':
            {
                // let image = setupObj[provider].image || setupObj[provider];
                // await conn.run(image, '/bin/bash', name);

                break;
            }
            default:
                throw new Error(`Unsupported target type: ${target.type}`);
        }

        let connState = await conn.getState(name);
        if (connState != 'ready') {
            console.error('Error: Target environment is not ready.');
        }
        console.log(`Headless infrastructure is using '${target.type}' provider and is: '${connState}'`);
        return conn;
    }
}

module.exports = Infra;
