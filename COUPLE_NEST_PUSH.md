# 一键说明：本机 git 被环境拦截，请你本地执行推送

cd C:\Users\22748\WeChatProjects\ricktv-main
# 若还没 git 初始化（zip 解压的）：
git init
git remote add origin https://github.com/crick137/ricktv.git
git fetch origin
git checkout -B main origin/main
# 把改过的三个文件拷进工作区后再：
git add public/couple-nest-sync.js src/app/layout.tsx src/app/play/page.tsx
git commit -m "feat: Couple Nest 一起看同步桥 (vidstack + postMessage)"
git push origin main
