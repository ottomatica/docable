<!--
setup:
  local: {}
-->

# Failed_when

We expect this to pass as a failure is defined to happen when `exitCode==0` while it fails with exitCode 127.

```bash|{type:'command', failed_when:'exitCode==1'}
foocommand
```
