
# Working with files

Create file with content.

```bash|{type:'file',path:'/tmp/docable_file'}
hello 
docable
```

Check file.

```bash|{type:'command'}
pwd
cat /tmp/docable_file
```

Create a directory with path.

```bash|{type:'file',path:'docable_test/docable_file'}
hello 
docable
```

Append content.

```bash|{type:'file', path:'docable_test/docable_file', mode: 'append'}
APPEND content.
```

```bash |{type:'command', failed_when: "!stdout.includes('APPEND')"}
pwd
cat docable_test/docable_file
```

Remove directory.

```bash|{type:'command'}
rm -rf docable_test
```


Use home directory for path.

```bash|{type:'file',path:'~/docable_test/docable_file'}
hello 
docable
```

```bash|{type:'command'}
cat ~/docable_test/docable_file
```


Remove directory

```bash|{type:'command'}
rm -rf ~/docable_test
```
