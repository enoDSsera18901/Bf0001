# Third-Party Notices

AnswerSurface / Reality Lab is an original small application assembled from public patterns and libraries. It does not claim ownership of the underlying open-source projects below.

## JSEP

Repository: https://github.com/EricSmekens/jsep
License: MIT
Copyright: Stephen Oney and contributors / current JSEP maintainers.

Used as the expression parser. AnswerSurface provides its own deliberately restricted AST interpreter rather than evaluating generated JavaScript.

## @jsep-plugin/ternary

Repository: https://github.com/EricSmekens/jsep/tree/master/packages/ternary
License: MIT

Used to add official JSEP parsing support for ternary expressions.

## math.gl expression evaluator

Repository: https://github.com/visgl/math.gl
Relevant public reference: `modules/expressions/src/expression-eval.ts`
License: MIT
Copyright: vis.gl contributors.

Used as a design/security reference for the parse-to-AST then interpret pattern. AnswerSurface's evaluator is separately implemented and intentionally supports a smaller language.

## CopilotKit generative UI playground

Repository: https://github.com/CopilotKit/generative-ui-playground
Current showcase: https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/generative-ui-playground

Used as the primary public reference for the declarative generative-UI architecture: model/agent output describes an interface, while trusted frontend components render it.

## Vercel AI SDK / AI Gateway

Documentation: https://vercel.com/docs/ai-sdk

Used for structured model generation through a schema-validated output contract.

This notice is informational and does not replace the license text distributed by each dependency/package.
