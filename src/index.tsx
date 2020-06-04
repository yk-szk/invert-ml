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

type ColumnsType = { key: string, value: string };
type ResultType = Map<string, string[]> | string | null;
interface AppState {
  cols: ColumnsType,
  preset1_disabled: boolean,
  preset2_disabled: boolean,
  result: ResultType,
}

function describe_preset_button(p: ColumnsType) {
  return '"' + p.key + '"と"' + p.value + '"をセットします。';
}
function equal_cols(c1: ColumnsType, c2: ColumnsType) {
  return c1.key === c2.key && c1.value === c2.value;
}
const preset1_cols: ColumnsType = { key: 'MLアドレス', value: 'MLメンバー' };
const preset2_cols: ColumnsType = { key: 'MLメールアドレス(編集不可)', value: 'メンバー' };

class App extends React.Component<{}, AppState> {

  constructor(props: {}) {
    super(props)
    this.state = {
      cols: preset1_cols,
      preset1_disabled: true,
      preset2_disabled: false,
      result: null,
    }

    this.handleChange = this.handleChange.bind(this);
    this.handleButtonClick = this.handleButtonClick.bind(this);
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
          result: 'Something went wrong with FileReader',
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
          result: 'CSVのパースに失敗しました。' + err.message,
        })
      })

      parser.on('end', () => {
        console.log(header)
        const key_col_name = this.state.cols.key;
        const value_col_name = this.state.cols.value;
        const col_ml_addr = header.findIndex(name => name === key_col_name);
        if (col_ml_addr === -1) {
          this.setState({
            result: '[' + key_col_name + ']が見つかりませんでした。ヘッダは次の中から選ぶ必要があります。{' + header.join(', ') + '}',
          })
          return;
        }
        const col_ml_member = header.findIndex(name => name === value_col_name);
        if (col_ml_member === -1) {
          this.setState({
            result: '[' + value_col_name + ']が見つかりませんでした。ヘッダは次の中から選ぶ必要があります。{' + header.join(', ') + '}',
          })
          return;
        }
        const ml_addrs = body.map(row => row[col_ml_addr])
        const members = body.map(row => row[col_ml_member].split('\n').filter(e => e.length > 0))
        const addr2ml = invert(ml_addrs, members)
        this.setState({
          result: addr2ml,
        });
      })
      parser.write(decodedStr)
      parser.end()
    }
    reader.readAsArrayBuffer(file)
  }

  handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { target: { id, value } } = event;
    const cols: ColumnsType = { ...this.state.cols };
    if (id === 'col_key') {
      cols.key = value;
    }
    if (id === 'col_value') {
      cols.value = value;
    }
    const p1_disabled = equal_cols(preset1_cols, cols);
    const p2_disabled = equal_cols(preset2_cols, cols);
    console.log(cols, preset1_cols, p1_disabled);
    this.setState({
      cols: cols,
      preset1_disabled: p1_disabled,
      preset2_disabled: p2_disabled
    })
  }

  handleButtonClick(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const id = event.currentTarget.id;
    let cols: ColumnsType;
    let p1_disabled = false;
    let p2_disabled = false;
    if (id === 'btn_preset1') {
      cols = preset1_cols;
      p1_disabled = true;
    } else {
      cols = preset2_cols;
      p2_disabled = true;
    }
    this.setState({
      cols: cols,
      preset1_disabled: p1_disabled,
      preset2_disabled: p2_disabled
    })
  }

  render() {
    let result: React.ReactElement;
    if (typeof this.state.result === 'string') {
      result = (
        <div>
          <h2 className="error">エラー</h2>
          <div className="error">
            <p>
              {this.state.result}
            </p>
          </div>
        </div>
      )
    } else {
      const rows = Array<React.ReactElement>();
      if (this.state.result === null) {
        // rows.push
      } else {
        this.state.result.forEach((value, key) => {
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
      }
      const header = (
        <thead>
          <tr>
            <th>{this.state.cols.key}</th>
            <th>{this.state.cols.value}</th>
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
        <details className="dynamic" open={typeof this.state.result !== 'string'}>
          <summary data-open="閉じる" data-close="開く"></summary>
          <table className="config">
            <tbody>
              <tr>
                <td>
                  <label htmlFor="col_key">メーリングリストのヘッダ</label>
                </td>
                <td>
                  <input type="text" id="col_key" value={this.state.cols.key} onChange={this.handleChange} />
                </td>
              </tr>
              <tr>
                <td>
                  <label htmlFor="col_value">メールアドレスのヘッダ</label>
                </td>
                <td>
                  <input type="text" id="col_value" value={this.state.cols.value} onChange={this.handleChange} />
                </td>
              </tr>
            </tbody>
          </table>
          <button disabled={this.state.preset1_disabled} id="btn_preset1" onClick={this.handleButtonClick} title={this.state.preset1_disabled ? "" : describe_preset_button(preset1_cols)}>プリセット1(統計確認)</button>
          <button disabled={this.state.preset2_disabled} id="btn_preset2" onClick={this.handleButtonClick} title={this.state.preset2_disabled ? "" : describe_preset_button(preset2_cols)}>プリセット2(ML管理)</button>
        </details>

      </div>
    )
  }

}

ReactDOM.render(
  <App />,
  document.getElementById('root')
);