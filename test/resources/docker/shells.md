<!--
setup:
  docker: docableContainer
-->

# Shells

List the current directory contents.

```bash|{type:'command'}
ls
```

```bash|{type:'command', shell:'bash'}
echo "'hello'" | grep -c "'hello'"
```

```bash|{type:'command', shell:'bash', path: "/"}
ls -R | grep ":$" | sed -e "s/:$//" -e "s/[^-][^\/]*\//--/g" -e "s/^/ /" -e "s/-/|/"
```