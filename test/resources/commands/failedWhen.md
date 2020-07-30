<!--
setup:
  local: {}
-->

# Failed_when

We expect this to pass as a failure is defined to happen when `exitCode==0` while it fails with exitCode 127.

Ensure fails.
```bash|{type:'command',fail_when:'exitCode==0'}
exit 0
```
