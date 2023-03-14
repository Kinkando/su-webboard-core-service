deploy:
	git checkout deploy
	git merge origin/develop
	git push railway deploy
	git checkout origin/develop
	copy .vscode\.env .
	npm run dev