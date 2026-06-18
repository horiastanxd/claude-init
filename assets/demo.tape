# claude-init demo - render with: vhs assets/demo.tape
# Requires: vhs, ttyd, ffmpeg, a chrome/chromium binary.
# Runs the CLI on a throwaway Next.js + TypeScript sample repo.

Output assets/demo.gif

Set Shell "bash"
Set FontSize 20
Set Width 1100
Set Height 640
Set Padding 22
Set Margin 0
Set Theme "Dracula"
Set TypingSpeed 55ms
Set PlaybackSpeed 1.0

Hide
Type "source /tmp/demo-bin/demorc" Enter
Type "clear" Enter
Show

Sleep 800ms
Type "claude-init"
Sleep 700ms
Enter
Sleep 4s

Type "ls"
Sleep 400ms
Enter
Sleep 3.5s
