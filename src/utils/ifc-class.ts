export function resolveIfcClass(ifcType: string) {
  if (
    ifcType.includes('WALL') ||
    ifcType.includes('SLAB') ||
    ifcType.includes('ROOF') ||
    ifcType.includes('STAIR') ||
    ifcType.includes('RAMP')
  ) {
    return 'Architecture';
  }

  if (
    ifcType.includes('COLUMN') ||
    ifcType.includes('BEAM') ||
    ifcType.includes('MEMBER') ||
    ifcType.includes('PLATE') ||
    ifcType.includes('PILE') ||
    ifcType.includes('FOOTING')
  ) {
    return 'Structure';
  }

  if (
    ifcType.includes('DOOR') ||
    ifcType.includes('WINDOW') ||
    ifcType.includes('OPENING') ||
    ifcType.includes('CURTAINWALL')
  ) {
    return 'Envelope';
  }

  if (
    ifcType.includes('FLOW') ||
    ifcType.includes('DUCT') ||
    ifcType.includes('PIPE') ||
    ifcType.includes('CABLE') ||
    ifcType.includes('TERMINAL') ||
    ifcType.includes('ELECTRIC')
  ) {
    return 'MEP';
  }

  if (
    ifcType.includes('SPACE') ||
    ifcType.includes('STOREY') ||
    ifcType.includes('BUILDING') ||
    ifcType.includes('SITE')
  ) {
    return 'Spatial';
  }

  if (ifcType.includes('FURNISHING') || ifcType.includes('EQUIPMENT')) {
    return 'Equipment';
  }

  return 'Other';
}
