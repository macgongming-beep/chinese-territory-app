import { describe, expect, test } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'

/**
 * 구역선 저장·삭제는 성공 여부를 돌려준다. 화면은 **그 값을 보고서야**
 * 그리던 점을 지워야 한다.
 *
 * 예전에 두 번 어겼다.
 *   · 저장: `await onSaveCardBoundary(...)` 로 결과를 버려서, 실패해도
 *     draftBoundaryPoints 를 비워 한참 그린 것이 사라졌다
 *   · 삭제: `onDeleteCardBoundary(cardId)` 를 기다리지도 않고 바로 비웠다
 *     (계약을 Promise<boolean> 으로 고쳤는데 prop 타입이 void 로 되돌리고 있었다)
 *
 * 둘 다 "결과를 안 쓰는 호출" 이라는 한 가지 모양이라 AST 로 잡는다.
 * 글자 대조가 아니라 구문을 보므로 줄바꿈이나 이름 바꾸기에 흔들리지 않는다.
 */
const FILE = 'src/components/DesktopMap.tsx'
const GUARDED = ['onSaveCardBoundary', 'onDeleteCardBoundary']

type Call = { name: string; line: number; used: boolean }

function collectCalls(): Call[] {
  const src = ts.createSourceFile(
    FILE, readFileSync(FILE, 'utf-8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  )
  const out: Call[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
        && GUARDED.includes(node.expression.text)) {
      // 결과를 쓰려면 await 로 감싸고, 그 await 를 어딘가에 담거나 조건으로 써야 한다.
      const awaited = node.parent
      const used = ts.isAwaitExpression(awaited)
        && (ts.isVariableDeclaration(awaited.parent)
          || ts.isBinaryExpression(awaited.parent)
          || ts.isIfStatement(awaited.parent)
          || ts.isPrefixUnaryExpression(awaited.parent)
          || ts.isReturnStatement(awaited.parent))
      out.push({
        name: node.expression.text,
        line: src.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        used,
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  return out
}

describe('구역선 쓰기 결과 사용 감시', () => {
  const calls = collectCalls()

  test('감시 대상 호출을 실제로 찾았다', () => {
    // 이름이 바뀌어 0건이 되면 아래 시험이 통째로 헛돈다.
    for (const name of GUARDED) {
      expect(calls.filter((c) => c.name === name).length).toBeGreaterThan(0)
    }
  })

  test('구역선 저장·삭제 결과를 버리는 호출이 없다', () => {
    const ignored = calls.filter((c) => !c.used).map((c) => `${c.name} (line ${c.line})`)
    expect(ignored).toEqual([])
  })
})
