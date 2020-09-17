<!--
setup:
  docker: docableContainer
-->

# Simple command

Git a simple command in docker

```bash|{type:'command'}
ls
```

```bash|{type:'command'}
mkdir -p /root/hello
echo "hi" > /root/hello/file.txt
```

Commands should set cwd based on `path: <file>`.

```bash|{type:'command', path: '/root/hello'}
cat file.txt
```
