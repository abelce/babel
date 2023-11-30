import type { Options } from "./options.ts";
import {
  hasPlugin,
  validatePlugins,
  mixinPluginNames,
  mixinPlugins,
  type PluginList,
} from "./plugin-utils.ts";
import type {
  PluginConfig as ParserPlugin,
  FlowPluginOptions,
  RecordAndTuplePluginOptions,
  PipelineOperatorPluginOptions,
} from "./typings.ts";
import Parser from "./parser/index.ts";

import type { ExportedTokenType } from "./tokenizer/types.ts";
import {
  getExportedToken,
  tt as internalTokenTypes,
  type InternalTokenTypes,
} from "./tokenizer/types.ts";

import type { Expression, File } from "./types.ts";

export function parse(input: string, options?: Options): File {
  if (options?.sourceType === "unambiguous") { // 如果sourceType是不明确的
    options = {
      ...options,
    };
    try {
      options.sourceType = "module";
      const parser = getParser(options, input);
      const ast = parser.parse();

      if (parser.sawUnambiguousESM) {
        return ast;
      }

      if (parser.ambiguousScriptDifferentAst) {
        // Top level await introduces code which can be both a valid script and
        // a valid module, but which produces different ASTs:
        //    await
        //    0
        // can be parsed either as an AwaitExpression, or as two ExpressionStatements.
        try {
          options.sourceType = "script";
          return getParser(options, input).parse();
        } catch {}
      } else {
        // This is both a valid module and a valid script, but
        // we parse it as a script by default
        ast.program.sourceType = "script";
      }

      return ast;
    } catch (moduleError) {
      try {
        options.sourceType = "script";
        return getParser(options, input).parse();
      } catch {}

      throw moduleError;
    }
  } else {
    return getParser(options, input).parse();
  }
}

export function parseExpression(input: string, options?: Options): Expression {
  const parser = getParser(options, input);
  if (parser.options.strictMode) {
    parser.state.strict = true;
  }
  return parser.getExpression();
}

function generateExportedTokenTypes(
  internalTokenTypes: InternalTokenTypes,
): Record<string, ExportedTokenType> {
  const tokenTypes: Record<string, ExportedTokenType> = {};
  for (const typeName of Object.keys(
    internalTokenTypes,
  ) as (keyof InternalTokenTypes)[]) {
    tokenTypes[typeName] = getExportedToken(internalTokenTypes[typeName]);
  }
  return tokenTypes;
}

export const tokTypes = generateExportedTokenTypes(internalTokenTypes);

function getParser(options: Options | undefined | null, input: string): Parser {
  let cls = Parser;
  if (options?.plugins) {
    validatePlugins(options.plugins);
    cls = getParserClass(options.plugins);
  }

  return new cls(options, input);
}

const parserClassCache: { [key: string]: { new (...args: any): Parser } } = {};

/** Get a Parser class with plugins applied. */
// 初始化plugin
function getParserClass(pluginsFromOptions: PluginList): {
  new (...args: any): Parser;
} {
  // 判断是否包含 "estree" | "jsx" | "flow" | "typescript" | "v8intrinsic" | "placeholders"等plugin
  // 有的话就初始化对应的plugin的Parser，比如： jsx的parser为JSXParserMixin
  // 同时放在parserClassCache中进行缓存
  const pluginList = mixinPluginNames.filter(name =>
    hasPlugin(pluginsFromOptions, name),
  );

  const key = pluginList.join("/");
  // 从缓存中获取parser
  let cls = parserClassCache[key];
  if (!cls) {
    cls = Parser;
    // 创建plugins中的Parser并缓存
    // 通过多重继承的方式，将各个plugin中的Parser的方法融合到一个Parser上
    for (const plugin of pluginList) {
      // @ts-expect-error todo(flow->ts)
      cls = mixinPlugins[plugin](cls);
    }
    // 通过plugin的key记性缓存
    parserClassCache[key] = cls;
  }
  return cls;
}

export type {
  FlowPluginOptions,
  ParserPlugin,
  PipelineOperatorPluginOptions,
  RecordAndTuplePluginOptions,
};
export type ParserOptions = Partial<Options>;
