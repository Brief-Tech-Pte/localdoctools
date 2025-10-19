# Local Doc Tools (localdoctools)

Local doc tools, privacy focussed in your browser

## Install the dependencies

```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
quasar dev
```

### Lint the files

```bash
yarn lint
# or
npm run lint
```

### Format the files

```bash
yarn format
# or
npm run format
```

### Run unit tests

```bash
npm run test
# or
npm run test:watch
```

Generate a coverage report (saved under `coverage/`) with:

```bash
npm run test:coverage
```

### Build the app for production

```bash
quasar build
```

### Regenerate icons

Requires global tools: `icongenie` (`npm install -g @quasar/icongenie`) and ImageMagick's `magick` binary available on your PATH.

```bash
npm run icons
```

### Start the range-enabled PDF test server

A lightweight Express server can generate and serve a synthetic ~50 MB PDF that honours HTTP range requests—useful when developing the pdf.js viewer.

```bash
npm run pdf-server
```

The server listens on port `3100` by default (override with `PDF_SERVER_PORT=3200`). The generated file lives under `tmp/test-pdf.pdf`, which is ignored by Git and re-used between runs once it reaches the target size.

### Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).

## License

This project is licensed under the Apache License, Version 2.0.

- See the `LICENSE` file at the project root for the full license text.
- See the `NOTICE` file for attribution notices.

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the `LICENSE` for the specific language governing permissions and limitations under the License.
