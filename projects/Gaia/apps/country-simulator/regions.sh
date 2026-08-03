get_region() {

case "$COUNTRY" in

# NORTH AMERICA
unitedstates|canada|mexico)
  echo "northamerica"
  ;;

antiguaandbarbuda|bahamas|barbados|dominica|dominicanrepublic|grenada|haiti|jamaica|saintlucia|saintkittsandnevis|saintvincentandthegrenadines|trinidadandtobago|cuba)
  echo "caribbean"
  ;;

guatemala|belize|elsalvador|honduras|nicaragua|costarica|panama)
  echo "centralamerica"
  ;;

# SOUTH AMERICA
colombia|venezuela|guyana|suriname|ecuador)
  echo "north_southamerica"
  ;;

peru|bolivia|chile)
  echo "andes"
  ;;

brazil|argentina|paraguay|uruguay)
  echo "south_southamerica"
  ;;

# EUROPE
spain|portugal|italy|greece|malta|cyprus)
  echo "mediterranean"
  ;;

france|germany|belgium|netherlands|luxembourg|switzerland|austria)
  echo "central_europe"
  ;;

norway|sweden|finland|denmark|iceland)
  echo "nordic"
  ;;

poland|czechia|slovakia|hungary|romania|bulgaria)
  echo "eastern_europe"
  ;;

# AFRICA
morocco|algeria|tunisia|libya|egypt)
  echo "north_africa"
  ;;

nigeria|ghana|ivorycoast|senegal|mali)
  echo "west_africa"
  ;;

ethiopia|somalia|kenya|uganda|tanzania)
  echo "east_africa"
  ;;

southafrica|namibia|botswana|zimbabwe|zambia)
  echo "southern_africa"
  ;;

# ASIA
china|japan|southkorea|northkorea|mongolia)
  echo "east_asia"
  ;;

india|pakistan|bangladesh|nepal|srilanka)
  echo "south_asia"
  ;;

thailand|vietnam|cambodia|laos|myanmar|malaysia|singapore|indonesia|philippines)
  echo "southeast_asia"
  ;;

saudiarabia|uae|qatar|kuwait|oman|bahrain)
  echo "arabian_gulf"
  ;;

turkey|iran|iraq|syria|jordan|lebanon|israel)
  echo "middle_east"
  ;;

# OCEANIA
australia|newzealand)
  echo "australasia"
  ;;

fiji|samoa|tonga|kiribati|vanuatu|solomonislands|papuanewguinea)
  echo "pacific_islands"
  ;;

# DEFAULT
*)
  echo "$CONTINENT"
  ;;

esac

}