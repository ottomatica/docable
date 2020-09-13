
# Simple command with path

Simple command

```bash|{type:'command'}
mkdir test_dir
```

Run command in path.

```bash|{type:'command', path: 'test_dir'}
touch test.txt
echo "hello" > test.txt
```

```bash|{type:'command'}
ls -l test_dir/test.txt
```

```bash|{type:'command'}
rm -rf test_dir
```