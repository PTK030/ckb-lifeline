# The lifeline tools with a browser, so a test runs with one command:
#
#   docker run --rm ghcr.io/ptk030/lifeline-test verify --network mainnet
#   docker run --rm -v "$PWD/data:/app/data" ghcr.io/ptk030/lifeline-test test --network mainnet --conditions A,B
#
# Built from the repository root: docker build -f docker/lifeline-test.Dockerfile .

FROM mcr.microsoft.com/playwright:v1.65.1-noble AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/probe/package.json packages/probe/
COPY packages/cli/package.json packages/cli/
RUN npm ci --ignore-scripts
COPY packages packages
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.65.1-noble
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
COPY nodes nodes
RUN mkdir -p /app/data && chown pwuser /app/data
USER pwuser
ENTRYPOINT ["node", "/app/packages/cli/dist/cli.js", "--root", "/app"]
CMD ["--help"]
