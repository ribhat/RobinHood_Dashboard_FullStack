import datetime

month_conversion_dict = {'January': '01', 'February': '02', 'March': '03', 'April': '04', 'May': '05', "June": "06",
                         'July': '07',
                         'August': '08', 'September': '09', 'October': '10', 'November': '11', 'December': '12'}
months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November',
          'December']
default_year = 2025

current_dt = str(datetime.datetime.now())
curr_month = current_dt[5:7]
curr_year = current_dt[0:4]
curr_day = current_dt[8:10]