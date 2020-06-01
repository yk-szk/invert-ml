import React, { useCallback } from 'react'
import ReactDOM from 'react-dom';
import { useDropzone } from 'react-dropzone'
import iconv from "iconv-lite";
import parse from 'csv-parse'
import './index.css';

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
  col_key: string,
  col_value: string,
  rows: Map<string, string[]>,
  error: string,
}

class App extends React.Component<any, AppProps> {
  constructor(props: AppProps) {
    super(props)
    this.state = {
      col_key: 'MLアドレス',
      col_value: 'MLメンバー',
      rows: new Map<string, string[]>([['', ['']]]), // initialize rows with one entry to show empty table in the page
      error: '',
    }

    this.handleChange = this.handleChange.bind(this);
  }

  handleDrop(acceptedFiles: File[]) {
    const file = acceptedFiles[0];
    const reader = new FileReader()

    reader.onabort = () => alert('file reading was aborted')
    reader.onerror = () => alert('file reading has failed')
    reader.onload = () => {
      // Do whatever you want with the file contents
      if (!(reader.result instanceof ArrayBuffer)) {
        this.setState({
          error: 'Something went wrong with FileReader',
        })
        return;
      }
      const binary = reader.result;
      const decodedStr = iconv.decode(Buffer.from(binary), "windows-31j")

      let header: string[] = [];
      const body: string[][] = [];

      // Create the parser
      const parser = parse({
        delimiter: ',',
        skip_empty_lines: true,
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
        this.setState({
          error: 'CSVのパースに失敗しました。' + err.message,
        })
      })

      parser.on('end', () => {
        console.log(header)
        const key_col_name = this.state.col_key;
        const value_col_name = this.state.col_value;
        const col_ml_addr = header.findIndex(name => name === key_col_name);
        if (col_ml_addr === -1) {
          this.setState({
            error: '[' + key_col_name + ']が見つかりませんでした。ヘッダは次の中から選ぶ必要があります。{' + header.join(', ') + '}',
          })
          return;
        }
        const col_ml_member = header.findIndex(name => name === value_col_name);
        if (col_ml_member === -1) {
          this.setState({
            error: '[' + value_col_name + ']が見つかりませんでした。ヘッダは次の中から選ぶ必要があります。{' + header.join(', ') + '}',
          })
          return;
        }
        const ml_addrs = body.map(row => row[col_ml_addr])
        const members = body.map(row => row[col_ml_member].split('\n').filter(e => e.length > 0))
        const addr2ml = invert(ml_addrs, members)
        this.setState({
          rows: addr2ml,
          error: '',
        });
      })
      parser.write(decodedStr)
      parser.end()
    }
    reader.readAsArrayBuffer(file)
  }

  handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { target: { id, value } } = event;
    this.setState({ [id]: value } as unknown as Pick<AppProps, keyof AppProps>); // TODO: remove unknown
  }

  render() {
    let result: React.ReactElement;
    if (this.state.error !== '') {
      result = (
        <div>
          <h2 className="error">エラー</h2>
          <div className="error">
            <p>
              {this.state.error}
            </p>
          </div>
        </div>
      )
    } else {
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
            <th>{this.state.col_value}</th>
            <th>{this.state.col_key}</th>
          </tr>
        </thead>
      )
      result = (
        <div>
          <h2>結果</h2>
          <table className="result">
            {header}
            <tbody>
              {rows}
            </tbody>
          </table>
        </div>
      )
    }
    return (
      <div className="container">
        <MyDropzone
          onDrop={(acceptedFiles: File[]) => this.handleDrop(acceptedFiles)} />
        {result}
        <h2>設定</h2>
        <details className="dynamic" open={this.state.error !== ""}>
          <summary data-open="閉じる" data-close="開く"></summary>
          <table className="config">
            <tbody>
              <tr>
                <td>
                  <label htmlFor="col_key">メーリングリストのヘッダ</label>
                </td>
                <td>
                  <input type="text" title='メーリングリストのヘッダ' id="col_key" value={this.state.col_key} onChange={this.handleChange} />
                </td>
              </tr>
              <tr>
                <td>
                  <label htmlFor="col_value">メールアドレスのヘッダ</label>
                </td>
                <td>
                  <input type="text" title='メールアドレスのヘッダ' id="col_value" value={this.state.col_value} onChange={this.handleChange} />
                </td>
              </tr>
            </tbody>
          </table>
        </details>

      </div>
    )
  }

}

ReactDOM.render(
  <App />,
  document.getElementById('root')
);