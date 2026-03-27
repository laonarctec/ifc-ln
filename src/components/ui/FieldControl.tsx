import { clsx } from "clsx";
import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

type BaseFieldControlProps = {
  prefix?: ReactNode;
  suffix?: ReactNode;
  className?: string;
  elementClassName?: string;
};

type InputFieldControlProps = BaseFieldControlProps &
  Omit<ComponentPropsWithoutRef<"input">, "prefix"> & {
    as?: "input";
  };

type SelectFieldControlProps = BaseFieldControlProps &
  Omit<ComponentPropsWithoutRef<"select">, "prefix"> & {
    as: "select";
  };

type FieldControlProps = InputFieldControlProps | SelectFieldControlProps;

export function FieldControl(props: FieldControlProps) {
  const {
    as = "input",
    prefix,
    suffix,
    className,
    elementClassName,
    ...elementProps
  } = props as FieldControlProps & { as: "input" | "select" };

  const sharedElementClassName = clsx(
    "field-control-element",
    as === "select" && "field-control-select",
    elementClassName,
  );

  return (
    <label className={clsx("field-control", className)}>
      {prefix ? <span className="field-control-prefix">{prefix}</span> : null}
      {as === "select" ? (
        <select
          {...(elementProps as ComponentPropsWithoutRef<"select">)}
          className={sharedElementClassName}
        />
      ) : (
        <input
          {...(elementProps as ComponentPropsWithoutRef<"input">)}
          className={sharedElementClassName}
        />
      )}
      {suffix ? <span className="field-control-suffix">{suffix}</span> : null}
    </label>
  );
}
