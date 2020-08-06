const path = require('path');
const Connector = require('infra.connectors');

class Infra {
    constructor() { }

    static async select(setupObj, provider, cwd)
    {
        let opts = {};
        let name;
        if (provider === 'slim') {
            // choose slim provider (ie vbox, kvm, etc)
            opts['provider'] = setupObj[provider].provider || undefined;
            name = `${path.basename(cwd)}-docable-vm`;
        }

        if(provider === 'ssh') {
            name = setupObj.ssh.host;
            opts.privateKey = path.isAbsolute(setupObj.ssh.privateKey) ? 
                                       setupObj.ssh.privateKey : path.resolve(cwd, setupObj.ssh.privateKey);
        }

        if (provider === 'bakerx') {
            name = setupObj.bakerx;
        }

        let conn = Connector.getConnector(provider, name, opts);
        switch( provider )
        {
            case 'slim':
            {
                let image = setupObj[provider].image;

                if( await conn.getState(name).catch(() => false) === "running" ) { break; }
                if( !await conn.isImageAvailable(image) )
                {
                    console.log("Preparing slim one-time build")
                    await conn.build( path.join( cwd, image ));
                }
                await conn.delete(name);

                // passthrough options in setup directly.
                let options = setupObj[provider];
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
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }

        let connState = await conn.getState(name);
        if (connState != 'ready') {
            console.error('Error: Target environment is not ready.');
        }
        console.log(`Headless infrastructure is using '${provider}' provider and is: '${connState}'`);
        return conn;
    }
}

module.exports = Infra;
