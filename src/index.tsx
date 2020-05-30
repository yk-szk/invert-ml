import React, { useCallback } from 'react'
import ReactDOM from 'react-dom';
import { useDropzone } from 'react-dropzone'
import './index.css';
const parse = require('csv-parse')
const iconv = require("iconv-lite");

function MyDropzone(props: any) {
  const onDrop = useCallback(props.onDrop, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div {...getRootProps({ className: 'dropzone' })}>
      <input {...getInputProps()} />
      {
        isDragActive ?
          <p>ファイルを開く ...</p> :
          <p>CSVファイルをドロップ。もしくはクリックして選択。</p>
      }
    </div>
  )
}

function invert<S, T>(keys: S[], values: T[][]): Map<T, S[]> {
  let uniq_values = new Set<T>(values.reduce((sum, e) => sum.concat(e), []));
  const all_values = Array.from(uniq_values).sort()
  const inverted = new Map<T, S[]>(all_values.map(value => [value, []]));
  keys.map((key, key_index) => values[key_index].map(value => inverted.get(value)!.push(key)))
  return inverted;
}

interface AppProps {
  header: string[],
  rows: Map<string, string[]>,
}

class App extends React.Component<any, AppProps> {
  constructor(props: AppProps) {
    super(props)
    this.state = {
      header: ['メールアドレス', 'メーリングリスト'],
      rows: new Map<string, string[]>(),
    }
  }

  handleDrop(acceptedFiles: File[]) {
    const file = acceptedFiles[0];
    const reader = new FileReader()

    reader.onabort = () => alert('file reading was aborted')
    reader.onerror = () => alert('file reading has failed')
    reader.onload = () => {
      // Do whatever you want with the file contents
      const binaryStr = reader.result
      const decodedStr = iconv.decode(binaryStr, "windows-31j")

      let header: string[] = [];
      const body: string[][] = [];

      // Create the parser
      const parser = parse({
        delimiter: ',',
        skipEmptyLines: true,
      })
      // Use the readable stream api
      parser.on('readable', () => {
        let record: string[];
        while (Boolean(record = parser.read())) {
          if (header.length === 0) {
            header = record;
          } else {
            body.push(record);
          }
        }
      })
      // Catch any error
      parser.on('error', (err: any) => {
        alert(err.message)
      })


      parser.on('end', () => {
        console.log(header)
        const key_col_name = 'MLアドレス';
        const value_col_name = 'MLメンバー';
        const col_ml_addr = header.findIndex(name => name === key_col_name);
        if (col_ml_addr === -1) {
          alert('Could not find column ' + key_col_name);
          return;
        }
        const col_ml_member = header.findIndex(name => name === value_col_name);
        if (col_ml_member === -1) {
          alert('Could not find column ' + value_col_name);
          return;
        }
        const ml_addrs = body.map(row => row[col_ml_addr])
        const members = body.map(row => row[col_ml_member].split('\n').filter(e => e.length > 0))
        const addr2ml = invert(ml_addrs, members)
        this.setState({
          rows: addr2ml,
        });
      })

      parser.write(decodedStr)
      parser.end()
    }
    reader.readAsBinaryString(file)
  }

  render() {
    const rows = Array<React.ReactElement>();
    this.state.rows.forEach((value, key) => {
      rows.push(
        <tr key={key}>
          <td>{key}</td>
          <td>
            <ol>
              {value.map((e, i) => (<li key={i}>{e}</li>))}
            </ol>
          </td>
        </tr>
      )
    })
    const header = (
      <thead>
        <tr>
          <th>{this.state.header[0]}</th>
          <th>{this.state.header[1]}</th>
        </tr>
      </thead>
    )
    return (
      <div>
        <MyDropzone
          onDrop={(acceptedFiles: File[]) => this.handleDrop(acceptedFiles)} />
        <h2>結果</h2>
        <table>
          {header}
          <tbody>
            {rows}
          </tbody>
        </table>
      </div>
    )
  }

}

ReactDOM.render(
  <App />,
  document.getElementById('root')
);