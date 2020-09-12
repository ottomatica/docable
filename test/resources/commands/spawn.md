Save the following in 'server.sh' and make it executable.

```bash|{type: 'file', path: 'server.sh', permission: '+x'}
#!/bin/bash

LOCKFILE=510-bash.lock

# Exit if lockfile 
[ -f $LOCKFILE ] && echo "Lockfile is in use. Exiting..." && exit 1 

# Upon exit, remove lockfile.
function cleanup
{
    echo "cleaning up"
    rm -f $LOCKFILE
    exit 0
}

# Initiate the trap
trap cleanup EXIT

# Create lockfile
touch $LOCKFILE

# Simple web server (listen on port 8888)
while true; do { echo -e "HTTP/1.1 200 OK\n\n$(date)"; } | nc -l 8888; done
```

This will run a simple bash server that you can send commands to over the network.

```bash|{type:'command', shell: 'bash', spawn: true}
./server.sh
```

In a new terminal window, run:

```bash|{type:'command'}
wget -qO- localhost:8888
```

You should see your direct connects appear in your other terminal running the server process. If you try running `./server.sh` in another terminal, it should prevent you from running again.