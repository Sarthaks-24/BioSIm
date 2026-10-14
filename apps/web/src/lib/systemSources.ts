import type { SystemId } from '../systems/registry.ts'

/**
 * The references each body system's numbers rest on (X-1: Science, one section per system): the
 * source IDs its catalog rows cite, in the rows' order. Written out here because the rows ride in the
 * engine's chunk, which the Science page does not load; systemSources.test.ts recomputes every list
 * from the rows, so nothing here is a new claim. Drawing-only rows (bones) cite none; lymph's since U-5.
 * Digestion's are the gut, blood sugar and energy rows and its moments.
 */
export const SYSTEM_SOURCES: { readonly [S in SystemId]?: readonly string[] } = {
  digestion: [
    'ziessman2009',
    'brener1983',
    'hunt1975',
    'abell2008',
    'siegel1988',
    'openstax-ap2e-23',
    'nandhra2023',
    'freckmann2007',
    'bergman1979',
    'brouns2005',
    'moghaddam2006',
    'atkinson2008',
    'fao2003',
    'faowhounu2004',
    'icmr-nin2020',
    'herrmann2024',
    'westerterp2004',
    'reed1996',
    'ada2001',
    'wang2015',
  ],
  breathing: ['kaiyala2019', 'byrne2005', 'herrmann2024', 'charriere2016', 'gribok2016', 'spriet2020', 'openstax-ap2e-22'],
  circulation: [
    'klabunde2023',
    'stringer2005',
    'cook2005',
    'openstax-ap2e-19',
    'higginbotham1986',
    'eriksen1994',
    'sieber1992',
    'waaler1991',
    'kelbaek1989',
    'openstax-ap2e-20',
  ],
  kidneys: ['openstax-ap2e-26', 'openstax-ap2e-25', 'iom2005', 'maughan2016', 'crowe1987', 'calvi2024', 'openstax-ap2e-23'],
  lymph: ['openstax-ap2e-21', 'openstax-ap2e-23', 'nordestgaard2016', 'liu2022', 'openstax-ap2e-18', 'odoherty2018', 'joshi2014'],
  muscles: ['wang2012', 'janssen2000', 'herrmann2024', 'icmr-nin2020'],
  bones: [],
  skin: ['baker2019', 'bakerwolfe2020', 'openstax-ap2e-24', 'herrmann2024', 'icmr-nin2020'],
}
