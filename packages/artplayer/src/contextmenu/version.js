import { version } from '../../package.json';

export default function (option) {
  return {
    ...option,
    html: `<a href="https://ddplayer.dev" target="_blank" style="width:100%;">DDPlayer ${version}</a>`,
  };
}
