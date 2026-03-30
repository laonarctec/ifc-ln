import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Plus,
  Tag,
} from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconActionButton } from "@/components/ui/IconActionButton";
import {
  fetchBsddClass,
  groupPropertiesByPset,
  buildBsddWebUrl,
  type BsddClassInfo,
  type BsddClassProperty,
} from "@/services/bsdd";

interface BsddCardProps {
  entityType: string | null;
  existingProps: Set<string>;
}

type LoadingState = "idle" | "loading" | "loaded" | "error";

export function BsddCard({ entityType, existingProps }: BsddCardProps) {
  const [classInfo, setClassInfo] = useState<BsddClassInfo | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [expandedPsets, setExpandedPsets] = useState<Set<string>>(new Set());
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setClassInfo(null);
    setAddedKeys(new Set());

    if (!entityType) {
      setLoadingState("idle");
      return;
    }

    setLoadingState("loading");
    void fetchBsddClass(entityType).then((data) => {
      setClassInfo(data);
      setLoadingState(data ? "loaded" : "error");
    });
  }, [entityType]);

  const psetGroups = useMemo(() => {
    if (!classInfo?.classProperties) return new Map<string, BsddClassProperty[]>();
    return groupPropertiesByPset(classInfo.classProperties);
  }, [classInfo]);

  const togglePset = useCallback((psetName: string) => {
    setExpandedPsets((prev) => {
      const next = new Set(prev);
      if (next.has(psetName)) {
        next.delete(psetName);
      } else {
        next.add(psetName);
      }
      return next;
    });
  }, []);

  const makePropKey = (pset: string, name: string) => `${pset}:${name}`;

  const isAlreadyPresent = useCallback(
    (pset: string, name: string) => {
      const key = makePropKey(pset, name);
      return existingProps.has(key) || addedKeys.has(key);
    },
    [existingProps, addedKeys],
  );

  const handleAddProperty = useCallback(
    (pset: string, prop: BsddClassProperty) => {
      const key = makePropKey(pset, prop.name);
      setAddedKeys((prev) => new Set(prev).add(key));
    },
    [],
  );

  if (!entityType) {
    return (
      <EmptyState
        icon={<Tag size={16} />}
        title="bSDD"
        description="엔티티를 선택하면 bSDD에서 관련 속성을 확인할 수 있습니다."
      />
    );
  }

  if (loadingState === "loading") {
    return (
      <PanelCard title="bSDD" description={entityType}>
        <div className="flex items-center gap-2 py-4 text-[0.78rem] text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          <span>bSDD에서 속성 정보를 가져오는 중...</span>
        </div>
      </PanelCard>
    );
  }

  if (loadingState === "error" || !classInfo) {
    return (
      <EmptyState
        icon={<Tag size={16} />}
        title="bSDD"
        description={`${entityType}에 대한 bSDD 정보를 찾을 수 없습니다.`}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <PanelCard
        title="bSDD"
        description={classInfo.name}
        actions={
          <a
            href={buildBsddWebUrl(entityType)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[0.7rem] text-primary hover:underline"
          >
            <ExternalLink size={12} />
          </a>
        }
      >
        {classInfo.definition ? (
          <p className="text-[0.76rem] leading-relaxed text-text-secondary">
            {classInfo.definition}
          </p>
        ) : null}
      </PanelCard>

      {[...psetGroups.entries()].map(([psetName, props]) => {
        const isExpanded = expandedPsets.has(psetName);
        const addableCount = props.filter(
          (p) => !isAlreadyPresent(psetName, p.name),
        ).length;

        return (
          <div key={psetName} className="prop-list">
            <button
              type="button"
              className="prop-header flex cursor-pointer items-center gap-2 border-b-0"
              onClick={() => togglePset(psetName)}
            >
              <ChevronDown
                size={14}
                className={clsx(
                  "shrink-0 text-text-muted transition-transform duration-150",
                  !isExpanded && "-rotate-90",
                )}
              />
              <span className="prop-label flex-1 text-left">{psetName}</span>
              {addableCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[0.62rem] font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                  {addableCount}
                </span>
              ) : null}
            </button>

            {isExpanded
              ? props.map((prop) => {
                  const present = isAlreadyPresent(psetName, prop.name);

                  return (
                    <div key={prop.name} className="prop-row">
                      <div className="min-w-0 flex-1">
                        <span className="prop-key block">{prop.name}</span>
                        {prop.description ? (
                          <span className="block text-[0.68rem] text-text-subtle">
                            {prop.description}
                          </span>
                        ) : null}
                        {prop.dataType ? (
                          <span className="text-[0.66rem] text-text-muted">
                            {prop.dataType}
                            {prop.units?.length ? ` (${prop.units.join(", ")})` : ""}
                          </span>
                        ) : null}
                      </div>
                      {present ? (
                        <Check size={14} className="shrink-0 text-green-600" />
                      ) : (
                        <IconActionButton
                          icon={<Plus size={14} />}
                          iconOnly
                          aria-label={`${prop.name} 추가`}
                          onClick={() => handleAddProperty(psetName, prop)}
                        />
                      )}
                    </div>
                  );
                })
              : null}
          </div>
        );
      })}
    </div>
  );
}
