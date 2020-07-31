<!--
setup:
  local: {}
-->

# Failed_when

Although exit code 0 indicates success, we expect this to fail because a failure is defined to happen when `exitCode==0`.

Ensure fails.
```bash|{type:'command',failed_when:'exitCode==0'}
exit 0
```
